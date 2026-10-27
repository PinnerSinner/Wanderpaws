// One weather event per run, picked from the world's list by the seed.
// Rain and snow loosen your grip (and grow puddles), the data storm jostles
// items, the parade passes through, fog and aurora are visual.
import { EV } from '../core/events.js';
import { IS_IDLE } from './items.js';

export const WEATHER_KINDS = ['clear', 'rain', 'fog', 'parade', 'aurora', 'datastorm', 'snow'];

export function createWeather(S) {
  const rng = S.rng.fork('weather');
  const opts = (S.world.weather && S.world.weather.length ? S.world.weather : ['clear']).filter((k) => WEATHER_KINDS.includes(k));
  const kind = opts.length ? rng.pick(opts) : 'clear';
  const W = { rng, start: rng.range(6, 25), rise: 12, hold: rng.range(70, 140), jostleT: 1.5 };
  if (kind === 'aurora') { W.start = Math.max(20, (S.world.goals && S.world.goals.timer || 240) * 0.55); W.hold = 9999; }
  if (kind === 'parade') W.hold = 45;
  S.state.weather.kind = kind;
  S.state.weather.t = 0;
  S.state.weather.intensity = 0;
  return W;
}

export function stepWeather(S, dt) {
  const w = S.state.weather, W = S.weatherCtl;
  if (!W || w.kind === 'clear') return;
  w.t += dt;
  const t = w.t - W.start;
  let target;
  if (t < 0) target = 0;
  else if (t < W.rise) target = t / W.rise;
  else if (t < W.rise + W.hold) target = 1;
  else target = w.kind === 'rain' ? 0.15 : w.kind === 'parade' ? 0 : 0.6; // drizzle into sun
  w.intensity += (target - w.intensity) * Math.min(1, dt * 0.8);
  if (w.kind === 'datastorm' && w.intensity > 0.3) {
    W.jostleT -= dt;
    if (W.jostleT <= 0) {
      W.jostleT = 1.2 + W.rng.next() * 1.5;
      const I = S.I;
      for (let k = 0; k < 6; k++) {
        const i = W.rng.int(0, I.count - 1);
        if (I.state[i] === IS_IDLE) S.items.wobble(i, 1.5 * w.intensity, W.rng.range(-1, 1), W.rng.range(-1, 1));
      }
    }
  }
}

export function announceWeather(S) {
  if (S.state.weather.kind !== 'clear') S.emit({ type: EV.WEATHER, kind: S.state.weather.kind });
}
