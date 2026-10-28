// Render test harness (not shipped): drives the real renderer with the real
// sim on a world file directly, with a greedy gobbler bot, so the level visuals
// can be checked before the world index is wired up. Built by build.mjs.
//   .out/render-harness.html?world=w1&t=20&quality=low
import { createBus, EV } from '../../../src/core/events.js';
import { createStorage } from '../../../src/core/storage.js';
import { createSettings } from '../../../src/core/settings.js';
import { createLoop } from '../../../src/core/loop.js';
import { getSpecies } from '../../../src/animals/species.js';
import { createSim } from '../../../src/sim/index.js';
import { createRenderer } from '../../../src/render/index.js';
import { W1 } from '../../../src/worlds/w1-copacabana.js';
import { W2 } from '../../../src/worlds/w2-london.js';
import { W3 } from '../../../src/worlds/w3-tijuca.js';

const q = new URLSearchParams(location.search);
const worlds = { w1: W1, w2: W2, w3: W3 };
const world = worlds[q.get('world') || 'w1'] || W1;
const species = getSpecies(q.get('species') || 'oli');
const settings = createSettings(createStorage('gp-harness'));
settings.set('quality', q.get('tier') || q.get('quality') || 'low');
if (q.has('shapes')) settings.set('shapeCodes', true);
if (q.has('cb')) settings.set('colourBlind', q.get('cb'));
const bus = createBus();
let paused = false;
const app = { get paused() { return paused; } };
const renderer = createRenderer({ canvas: document.getElementById('game'), overlay: document.getElementById('float'), settings, bus, app });
const sim = createSim({ world, species, look: species.defaults, mode: 'chill', seed: Number(q.get('seed') || 7) });
renderer.showScene('level', { world, sim, species, look: { ...species.defaults, trail: q.get('trail') }, ghost: null });

const frameIn = { mx: 0, mz: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false, bark: false, barkHeld: false, aimYaw: 0 };
let target = -1;
function bot() {
  const s = sim.state, p = s.player, it = s.items;
  if (target < 0 || it.state[target] !== 0 || !it.gobbleable[target]) {
    target = -1; let best = 1e9;
    for (let i = 0; i < it.count; i++) {
      if (it.state[i] !== 0 || !it.gobbleable[i]) continue;
      const d = Math.hypot(it.x[i] - p.x, it.z[i] - p.z);
      if (d < best) { best = d; target = i; }
    }
  }
  if (target >= 0) {
    const dx = it.x[target] - p.x, dz = it.z[target] - p.z, l = Math.hypot(dx, dz) || 1;
    frameIn.mx = dx / l; frameIn.mz = dz / l;
  } else { frameIn.mx = Math.sin(s.time * 0.3); frameIn.mz = Math.cos(s.time * 0.3); }
  frameIn.sprint = (s.tick % 400) > 250;
  frameIn.aimYaw = renderer.getCameraYaw();
  return frameIn;
}
function step() {
  if (paused) return;
  sim.step(bot());
  for (const ev of sim.events) bus.emit(ev.type, ev);
  sim.events.length = 0;
}
// fast-forward
const ff = Math.round(Number(q.get('t') || 0) * 60);
for (let i = 0; i < ff; i++) { sim.step(bot()); sim.events.length = 0; }
const loop = createLoop({ step, render: (a, dt) => renderer.frame(a, dt, sim.state) });
loop.start();
const lines = [
  { speaker: 'kev', text: 'Oi! No running on the promenade!', lang: 'en-GB', anchor: 'player', style: 'chatter' },
  { speaker: 'ze', text: 'Olha o mate, olha o biscoito!', sub: 'Get your iced tea, get your biscuits!', lang: 'pt-BR', anchor: { x: sim.state.player.x + 1, y: sim.state.player.y + 0.6, z: sim.state.player.z + 1.5 }, style: 'chatter' },
  { speaker: 'player', text: 'Is that... a whole biscuit?', lang: 'en-GB', anchor: 'player', style: 'thought' },
];
setTimeout(() => lines.forEach((l, i) => setTimeout(() => renderer.floatingText.add(l), i * 120)), 300);
if (q.has('milestone')) setTimeout(() => bus.emit(EV.MILESTONE, { type: EV.MILESTONE, index: 1, size: 0.5 }), Number(q.get('milestone')));
if (q.has('weather')) renderer.setWeatherOverride(q.get('weather'), 1);
if (q.has('photo')) setTimeout(() => { paused = true; renderer.enterPhoto(); renderer.photo.setFilter(q.get('photo')); }, 1000);
window.__gp = { renderer, sim, bus, settings, loop, fps: 0 };
setInterval(() => { window.__gp.fps = renderer.stats().fps; }, 500);
