// Gamepad maths (pure): radial deadzones, response curves and standard-mapping
// button names. Works on plain objects so tests can feed fake pads.

export const PAD = Object.freeze({
  A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9,
  L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
});

// Radial deadzone with rescale: inside `inner` is zero, beyond `outer` is
// full, and the response is curved by `power` (1 = linear, 2 = gentle centre).
// Writes into `out` ({x, y, mag}) to avoid allocation.
export function radialDeadzone(x, y, inner = 0.15, outer = 0.95, power = 1.6, out = { x: 0, y: 0, mag: 0 }) {
  const m = Math.hypot(x, y);
  if (!(m > inner)) { out.x = 0; out.y = 0; out.mag = 0; return out; }
  const t = Math.min(1, (m - inner) / Math.max(1e-6, outer - inner));
  const c = responseCurve(t, power);
  out.x = (x / m) * c;
  out.y = (y / m) * c;
  out.mag = c;
  return out;
}

export function responseCurve(t, power = 1.6) {
  const v = Math.max(0, Math.min(1, t));
  return Math.pow(v, power);
}

// Axial deadzone for triggers or a single axis.
export function axisDeadzone(v, inner = 0.1) {
  const a = Math.abs(v);
  if (a <= inner) return 0;
  return Math.sign(v) * Math.min(1, (a - inner) / (1 - inner));
}

export function buttonPressed(b, threshold = 0.5) {
  if (b == null) return false;
  if (typeof b === 'number') return b > threshold;
  return !!b.pressed || (typeof b.value === 'number' && b.value > threshold);
}

// Direction from the d-pad, or the stick beyond a threshold (for menus).
export function padDirection(gp, threshold = 0.55) {
  if (!gp) return null;
  const btn = gp.buttons || [];
  if (buttonPressed(btn[PAD.UP])) return 'up';
  if (buttonPressed(btn[PAD.DOWN])) return 'down';
  if (buttonPressed(btn[PAD.LEFT])) return 'left';
  if (buttonPressed(btn[PAD.RIGHT])) return 'right';
  const ax = gp.axes || [];
  const x = ax[0] || 0, y = ax[1] || 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < threshold) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

// Pick the most recently active connected pad.
export function pickPad(pads) {
  let best = null;
  for (const p of pads || []) {
    if (!p || p.connected === false) continue;
    if (!best || (p.timestamp || 0) > (best.timestamp || 0)) best = p;
  }
  return best;
}

// Any meaningful activity (for device switching).
export function padActive(gp, threshold = 0.3) {
  if (!gp) return false;
  for (const b of gp.buttons || []) if (buttonPressed(b, 0.3)) return true;
  for (const a of gp.axes || []) if (Math.abs(a) > threshold) return true;
  return false;
}
