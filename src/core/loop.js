import { SIM_DT } from './game.js';

// Fixed 60 Hz simulation with render interpolation. The sim never reads the
// clock: it is stepped a whole number of times per frame by this loop.
export function createLoop({ step, render, maxSteps = 5 }) {
  let acc = 0;
  let last = 0;
  let running = false;
  let raf = 0;
  let timeScale = 1; // photo mode / slow-mo beats stretch real time, sim stays fixed-step

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dtReal = Math.min(0.1, last ? (now - last) / 1000 : SIM_DT);
    last = now;
    acc += dtReal * timeScale;
    let n = 0;
    while (acc >= SIM_DT && n < maxSteps) {
      step(SIM_DT);
      acc -= SIM_DT;
      n++;
    }
    if (n === maxSteps) acc = 0; // drop backlog rather than spiral
    render(acc / SIM_DT, dtReal, n);
  }

  return {
    start() { if (running) return; running = true; last = 0; raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; },
    setTimeScale(s) { timeScale = Math.max(0, s); },
    get timeScale() { return timeScale; },
  };
}

// Headless helper for tests and sims: run n fixed ticks.
export function runFixed(n, step) {
  for (let i = 0; i < n; i++) step(SIM_DT, i);
}
