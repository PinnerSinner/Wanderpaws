#!/usr/bin/env node
// Headless bots for every species x every world.
//   node tools/sim.mjs                         all species, all worlds (real WORLDS when present, else fixtures)
//   node tools/sim.mjs --world w1 --species oli --seconds 300
//   node tools/sim.mjs --bot greedy|random|both --seed 7 --fixtures --mode story --assist --json
// Reports: reached goal (time), reached stretch, max size, gobbled, stuck events,
// launched props, mean and max ms per step. Exits non-zero on soft-locks or launches.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(root, p)).href);

const args = process.argv.slice(2);
const argVal = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const has = (k) => args.includes(k);

async function loadWorlds(forceFixtures) {
  const { CATALOGUE } = await imp('src/worlds/catalogue.js');
  let real = [];
  if (!forceFixtures) {
    try {
      const W = await imp('src/worlds/index.js');
      real = (W.WORLDS || []).filter((w) => {
        if (!w || typeof w.heightAt !== 'function' || !w.items) return false;
        const fills = w.items.fill || [];
        const anchors = w.items.anchors || [];
        let known = 0;
        for (const f of fills) for (const t of f.types || []) if (CATALOGUE[t]) known++;
        for (const a of anchors) if (CATALOGUE[a.type]) known++;
        return known > 3;
      });
    } catch (e) { console.warn(`[sim] real worlds failed to load: ${e.message}`); }
  }
  if (real.length) return { worlds: real, source: 'real' };
  const F = await imp('test/sim/fixtures/worlds.js');
  return { worlds: F.FIXTURES, source: 'fixtures' };
}

// ---------------- bots ----------------
function makeInput() { return { mx: 0, mz: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false, bark: false, barkHeld: false, aimYaw: 0 }; }

function greedyBot(sim, rng) {
  const st = sim.state, S = sim._S, I = st.items;
  const inp = makeInput();
  let target = -1, retarget = 0, targetT = 0;
  const banned = new Float32Array(I.count);
  let wander = 0, wanderYaw = 0, sideSign = 1, sideT = 0;
  let lastX = st.player.x, lastZ = st.player.z, progT = 0;
  let sigHold = 0;
  return function think(dt) {
    const p = st.player;
    inp.jump = false; inp.sig = false; inp.bark = false;
    for (let i = 0; i < I.count; i++) if (banned[i] > 0) banned[i] -= dt;
    // progress watchdog
    progT += dt;
    if (progT > 2.5) {
      const moved = Math.hypot(p.x - lastX, p.z - lastZ);
      if (moved < p.size * 0.8) { wander = 1.2; wanderYaw = rng() * Math.PI * 2; if (target >= 0) banned[target] = 12; target = -1; inp.jump = true; }
      lastX = p.x; lastZ = p.z; progT = 0;
    }
    retarget -= dt; targetT += dt;
    if (target >= 0 && (I.state[target] > 2 || !I.gobbleable[target])) target = -1;
    if (target >= 0 && targetT > 9) { banned[target] = 15; target = -1; }
    if (target < 0 || retarget <= 0) {
      retarget = 0.25;
      let best = -1, bestScore = -Infinity;
      for (let i = 0; i < I.count; i++) {
        if (!I.gobbleable[i] || I.state[i] > 2 || banned[i] > 0) continue;
        const d = Math.hypot(I.x[i] - p.x, I.z[i] - p.z);
        const s = I.size[i];
        const score = (s * s * s) / Math.pow(d + p.size * 2, 2.2) * (I.golden[i] ? 50 : 1);
        if (score > bestScore) { bestScore = score; best = i; }
      }
      if (best !== target) targetT = 0;
      target = best;
    }
    let yaw;
    if (wander > 0) { wander -= dt; yaw = wanderYaw; }
    else if (target >= 0) yaw = Math.atan2(I.x[target] - p.x, I.z[target] - p.z);
    else {
      // nothing gobble-able known: head for the middle and roam
      const b = S.terrain.bounds;
      if (rng() < 0.01) wanderYaw = rng() * Math.PI * 2;
      yaw = Math.hypot(p.x, p.z) > (b.maxX - b.minX) * 0.35 ? Math.atan2(-p.x, -p.z) : wanderYaw;
    }
    // simple avoidance: slide along walls
    if (S.run.wallHit) { sideT = 0.4; if (rng() < 0.05) sideSign = -sideSign; }
    if (sideT > 0) { sideT -= dt; yaw += sideSign * 1.1; }
    inp.mx = Math.sin(yaw); inp.mz = Math.cos(yaw);
    inp.sprint = true;
    // signature: use it when ready and something is around
    const sg = p.sig;
    if (sigHold > 0) { sigHold -= dt; inp.sigHeld = sigHold > 0; }
    else inp.sigHeld = false;
    if (sg.ready && target >= 0 && rng() < 0.03) {
      inp.sig = true;
      if (sg.kind === 'sniffBoost' || sg.kind === 'superHop') { sigHold = 0.5; inp.sigHeld = true; }
    }
    if (rng() < 0.002) inp.bark = true;
    return inp;
  };
}

function randomBot(sim, rng) {
  const inp = makeInput();
  let yaw = 0, t = 0;
  return function think(dt) {
    t -= dt;
    inp.jump = false; inp.sig = false; inp.bark = false;
    if (t <= 0) { t = 0.5 + rng() * 2.5; yaw = rng() * Math.PI * 2; inp.sprint = rng() < 0.5; }
    inp.mx = Math.sin(yaw); inp.mz = Math.cos(yaw);
    if (rng() < 0.01) inp.jump = true;
    if (rng() < 0.005) inp.sig = true;
    inp.sigHeld = inp.sig;
    if (rng() < 0.004) inp.bark = true;
    return inp;
  };
}

function mulberry(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

async function runOne({ worldId, speciesId, bot, seconds, seed, mode, assist, forceFixtures }) {
  const { createSim } = await imp('src/sim/index.js');
  const { SPECIES } = await imp('src/animals/species.js');
  const { worlds } = await loadWorlds(forceFixtures);
  const world = worlds.find((w) => w.id === worldId);
  const species = SPECIES[speciesId];
  const sim = createSim({ world, species, mode, seed, assist });
  const rng = mulberry(seed * 7919 + 13);
  const think = bot === 'random' ? randomBot(sim, rng) : greedyBot(sim, rng);
  const st = sim.state, p = st.player;
  const dt = 1 / 60;
  const steps = Math.round(seconds * 60) + 120;
  let maxSize = p.size, stuckEvents = 0, stuckT = 0, longestStuck = 0, sumMs = 0, maxMs = 0, n = 0;
  let wx = p.x, wz = p.z, winT = 0;
  const msArr = [];
  for (let i = 0; i < steps; i++) {
    const inp = think(dt);
    const t0 = performance.now();
    sim.step(inp);
    const ms = performance.now() - t0;
    sim.events.length = 0;
    if (i > 30) { sumMs += ms; n++; if (ms > maxMs) maxMs = ms; msArr.push(ms); }
    if (p.size > maxSize) maxSize = p.size;
    if (st.phase === 'play') {
      winT += dt;
      if (winT >= 5) {
        const moved = Math.hypot(p.x - wx, p.z - wz);
        if (moved < p.size * 0.5) { stuckEvents++; stuckT += 5; if (stuckT > longestStuck) longestStuck = stuckT; } else stuckT = 0;
        wx = p.x; wz = p.z; winT = 0;
      }
    }
    if (st.phase === 'finished' && bot !== 'random') break;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.size)) { stuckEvents += 99; break; }
  }
  msArr.sort((a, b) => a - b);
  const R = sim._S.run;
  return {
    worldId, speciesId, bot,
    goalT: R.goalTime, stretchT: R.stretchTime, timer: st.goals.timer,
    maxSize, gobbled: R.gobbled, stars: st.stars.map((s) => (s ? 1 : 0)).join(''),
    stuckEvents, longestStuck, launches: sim.debug.launches, maxItemSpeedRatio: sim.debug.maxItemSpeedRatio,
    meanMs: sumMs / Math.max(1, n), p99Ms: msArr[Math.floor(msArr.length * 0.99)] || 0, maxMs,
    items: st.items.count, npcs: st.npcs.length, birds: st.birds.count,
    warnings: sim.debug.warnings.slice(0, 5).concat(sim.debug.launchLog.map((l) => 'launch: ' + l)), eggErrors: sim.debug.eggErrors.slice(0, 5),
    hazards: st.starProgress.hazardsTouched, phase: st.phase,
  };
}

if (!isMainThread) {
  parentPort.on('message', async (job) => {
    try { parentPort.postMessage({ ok: true, res: await runOne(job) }); }
    catch (e) { parentPort.postMessage({ ok: false, err: `${job.worldId}/${job.speciesId}/${job.bot}: ${e.stack || e.message}` }); }
  });
} else {
  const forceFixtures = has('--fixtures');
  const { worlds, source } = await loadWorlds(forceFixtures);
  const { SPECIES_ORDER } = await imp('src/animals/species.js');
  const worldIds = argVal('--world') ? [argVal('--world')] : worlds.map((w) => w.id);
  const speciesIds = argVal('--species') ? [argVal('--species')] : SPECIES_ORDER;
  const botArg = argVal('--bot', 'both');
  const seconds = +argVal('--seconds', '0') || null;
  const seed = +argVal('--seed', '7');
  const mode = argVal('--mode', 'story');
  const assist = has('--assist');
  const jobs = [];
  for (const w of worldIds) {
    const world = worlds.find((x) => x.id === w);
    if (!world) { console.error(`unknown world ${w} (have ${worlds.map((x) => x.id).join(', ')})`); process.exit(2); }
    const secs = seconds || (world.goals && world.goals.timer) || 300;
    for (const s of speciesIds) {
      if (botArg !== 'random') jobs.push({ worldId: w, speciesId: s, bot: 'greedy', seconds: secs, seed, mode, assist, forceFixtures });
      if (botArg !== 'greedy') jobs.push({ worldId: w, speciesId: s, bot: 'random', seconds: Math.min(secs, 120), seed: seed + 1, mode, assist, forceFixtures });
    }
  }
  const nWorkers = Math.max(1, Math.min(jobs.length, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 0, +argVal('--workers', '8')));
  console.log(`[sim] ${jobs.length} runs on ${nWorkers} workers, worlds from ${source}: ${worldIds.join(', ')}`);
  const results = [];
  const errors = [];
  await new Promise((resolve) => {
    let next = 0, live = 0;
    const startWorker = () => {
      const w = new Worker(fileURLToPath(import.meta.url), { workerData: {} });
      live++;
      const feed = () => { if (next >= jobs.length) { w.terminate(); return; } w.postMessage(jobs[next++]); };
      w.on('message', (m) => { if (m.ok) results.push(m.res); else errors.push(m.err); feed(); });
      w.on('exit', () => { live--; if (live === 0) resolve(); });
      w.on('error', (e) => { errors.push(String(e)); });
      feed();
    };
    for (let i = 0; i < nWorkers; i++) startWorker();
  });
  const order = (r) => worldIds.indexOf(r.worldId) * 1000 + speciesIds.indexOf(r.speciesId) * 2 + (r.bot === 'random' ? 1 : 0);
  results.sort((a, b) => order(a) - order(b));
  if (has('--json')) { console.log(JSON.stringify(results, null, 1)); }
  const pad = (s, n) => String(s).padEnd(n);
  const fmtT = (t, timer) => (t == null ? '-' : `${t.toFixed(0)}s ${Math.round((t / timer) * 100)}%`);
  console.log(pad('world', 7) + pad('species', 11) + pad('bot', 8) + pad('goal', 11) + pad('stretch', 11) + pad('maxSize', 9) + pad('gobbled', 9) + pad('stars', 7) + pad('stuck', 7) + pad('launch', 8) + pad('ms mean', 9) + pad('p99', 7) + 'max');
  let softLocks = 0, launches = 0;
  for (const r of results) {
    const soft = r.longestStuck >= 20 || r.stuckEvents >= 99;
    if (soft) softLocks++;
    launches += r.launches;
    console.log(pad(r.worldId, 7) + pad(r.speciesId, 11) + pad(r.bot, 8) + pad(fmtT(r.goalT, r.timer), 11) + pad(fmtT(r.stretchT, r.timer), 11) + pad(r.maxSize.toFixed(2), 9) + pad(r.gobbled, 9) + pad(r.stars, 7) + pad(r.stuckEvents + (soft ? '!' : ''), 7) + pad(r.launches, 8) + pad(r.meanMs.toFixed(3), 9) + pad(r.p99Ms.toFixed(2), 7) + r.maxMs.toFixed(2));
  }
  const greedy = results.filter((r) => r.bot === 'greedy');
  const reached = greedy.filter((r) => r.goalT != null);
  const pcts = reached.map((r) => r.goalT / r.timer);
  console.log(`\n[sim] greedy reached goal: ${reached.length}/${greedy.length}` + (pcts.length ? `, goal at ${Math.round(Math.min(...pcts) * 100)}..${Math.round(Math.max(...pcts) * 100)}% of timer (median ${Math.round(pcts.sort((a, b) => a - b)[Math.floor(pcts.length / 2)] * 100)}%)` : ''));
  const allMs = results.map((r) => r.meanMs);
  console.log(`[sim] step ms: mean of means ${(allMs.reduce((a, b) => a + b, 0) / Math.max(1, allMs.length)).toFixed(3)}, worst max ${Math.max(0, ...results.map((r) => r.maxMs)).toFixed(2)}`);
  const warn = new Set(); for (const r of results) for (const w of r.warnings.concat(r.eggErrors)) warn.add(`${r.worldId}: ${w}`);
  if (warn.size) { console.log('[sim] warnings:'); for (const w of warn) console.log('  ' + w); }
  if (errors.length) { console.log('[sim] errors:'); for (const e of errors) console.log('  ' + e); }
  console.log(`[sim] soft-locks: ${softLocks}, launches: ${launches}`);
  process.exit(softLocks || launches || errors.length ? 1 : 0);
}
