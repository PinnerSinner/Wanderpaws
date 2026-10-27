// STUB (lead): replaced by the Sim agent. Just enough to wander about.
import { createRng } from '../core/rng.js';
import { CATALOGUE } from '../worlds/catalogue.js';
export function createSim({ world, species, mode = 'story', seed = 1 }) {
  const rng = createRng(seed);
  const types = Object.keys(CATALOGUE);
  const n = 60;
  const items = { count: n, types, typeIndex: new Uint16Array(n), x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
    px: new Float32Array(n), py: new Float32Array(n), pz: new Float32Array(n), rotY: new Float32Array(n), tilt: new Float32Array(n), tiltAxis: new Float32Array(n),
    scale: new Float32Array(n).fill(1), state: new Uint8Array(n), anim: new Float32Array(n), golden: new Uint8Array(n), size: new Float32Array(n).fill(0.1), gobbleable: new Uint8Array(n).fill(1), almost: new Uint8Array(n) };
  for (let i = 0; i < n; i++) { items.x[i] = items.px[i] = rng.range(-20, 20); items.z[i] = items.pz[i] = rng.range(-20, 20); }
  const player = { x: 0, y: 0, z: 0, yaw: 0, px: 0, py: 0, pz: 0, pyaw: 0, vx: 0, vy: 0, vz: 0, speed: 0, speedNorm: 0, size: world.goals.start, displaySize: world.goals.start,
    grounded: true, airborne: false, inWater: false, waterDepth: 0, surface: 'sand', sprinting: false, turnRate: 0, landImpact: 0, gulp: 0, stagger: 0,
    sig: { kind: species.signature.kind, active: false, t: 0, cooldownLeft: 0, ready: true, aimYaw: 0, power: 0 }, emotion: 'happy', idleTime: 0, idleAnim: null,
    barkT: 99, playBow: false, shakeT: 0, buffs: { tea: 0, wobble: 0, speed: 0 }, combo: { count: 0, mult: 1, timer: 0 }, reach: 0.2 };
  const state = { tick: 0, time: 0, phase: 'play', introLeft: 0, timeLeft: world.goals.timer, worldId: world.id, mode, goals: world.goals, stars: [false, false, false],
    starProgress: { hazardsTouched: 0, collected: {}, maxCombo: 0 }, result: null, slowMo: 0, player, items, npcs: [], birds: { count: 0 }, weather: { kind: 'clear', t: 0, intensity: 0 },
    tide: 0, zones: {}, flags: {}, activity: null, camHint: null };
  const events = [];
  return { state, events, step(f) {
    state.tick++; state.time += 1 / 60;
    player.px = player.x; player.pz = player.z; player.pyaw = player.yaw;
    const sp = 3 * player.size * 4;
    player.vx = f.mx * sp; player.vz = f.mz * sp;
    player.x += player.vx / 60; player.z += player.vz / 60;
    player.speed = Math.hypot(player.vx, player.vz); player.speedNorm = Math.min(1, player.speed / sp);
    if (player.speed > 0.01) player.yaw = Math.atan2(player.vx, player.vz);
  } };
}
