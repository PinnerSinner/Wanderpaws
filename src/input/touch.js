// Touch controls. No text labels and nothing on screen until it's needed:
//   left half   a floating stick, invisible until a thumb lands, which appears
//               under the thumb; pushed to its edge it means zoomies
//   right half  drag to look, tap to jump, double-tap (and hold) to bark
//   bottom right a single round button with a paw on it: the signature move
// The gesture logic is pure (createTouchGestures) so Node tests can drive it;
// createTouchControls wires it to the DOM.

import { t } from '../core/copy/index.js';
import '../meta/copy.js';   // registers meta.input.sig

export const TOUCH_DEFAULTS = Object.freeze({
  stickRadius: 60,     // px; the DOM layer sets it from the screen size
  deadzone: 0.12,
  edge: 0.9,           // stick magnitude that counts as "pushed to the edge"
  tapTime: 0.25,       // s, longest press that still counts as a tap
  tapMove: 14,         // px, furthest a tap may wander
  doubleGap: 0.32,     // s, second tap must start this soon after the first ends
  doubleDist: 80,      // px, and this close to it
  lookScale: 0.007,    // radians-ish per px of drag
});

export function createTouchGestures(opts = {}) {
  const o = { ...TOUCH_DEFAULTS, ...opts };
  const touches = new Map();
  const state = {
    moveX: 0, moveY: 0, mag: 0, sprint: false,
    jump: false, bark: false, barkHeld: false, sig: false, sigHeld: false,
    stick: { active: false, ox: 0, oy: 0, x: 0, y: 0 },
  };
  const look = { dx: 0, dy: 0 };
  const lookOut = { dx: 0, dy: 0 };
  const edges = { jump: false, bark: false, sig: false };
  let lastTapEnd = -Infinity, lastTapX = 0, lastTapY = 0;
  let stickId = null;

  function updateStick(x, y) {
    const s = state.stick;
    let dx = x - s.ox, dy = y - s.oy;
    let m = Math.hypot(dx, dy);
    const r = o.stickRadius;
    if (m > r) {
      // The base trails the thumb so the stick never "runs out".
      const k = (m - r) / m;
      s.ox += dx * k; s.oy += dy * k;
      dx = x - s.ox; dy = y - s.oy;
      m = r;
    }
    s.x = x; s.y = y;
    const n = m / r;
    if (n < o.deadzone) { state.moveX = 0; state.moveY = 0; state.mag = 0; state.sprint = false; return; }
    const scaled = (n - o.deadzone) / (1 - o.deadzone);
    state.moveX = (dx / m) * scaled;
    state.moveY = (-dy / m) * scaled;   // screen up = forward
    state.mag = scaled;
    state.sprint = n >= o.edge;
  }

  const api = {
    state,
    options: o,
    setOptions(p) { Object.assign(o, p); },
    // side: 'left' | 'right' (the DOM layer decides from the x position)
    start(id, x, y, time, side) {
      if (side === 'left' && stickId == null) {
        stickId = id;
        touches.set(id, { kind: 'stick', sx: x, sy: y, x, y, t0: time, moved: false });
        state.stick.active = true;
        state.stick.ox = x; state.stick.oy = y; state.stick.x = x; state.stick.y = y;
        updateStick(x, y);
        return 'stick';
      }
      const isDouble = time - lastTapEnd <= o.doubleGap && Math.hypot(x - lastTapX, y - lastTapY) <= o.doubleDist;
      if (isDouble) {
        lastTapEnd = -Infinity;
        edges.bark = true;
        state.barkHeld = true;
        touches.set(id, { kind: 'bark', sx: x, sy: y, x, y, t0: time, moved: false });
        return 'bark';
      }
      touches.set(id, { kind: 'look', sx: x, sy: y, x, y, t0: time, moved: false });
      return 'look';
    },
    move(id, x, y) {
      const tc = touches.get(id);
      if (!tc) return;
      if (tc.kind === 'stick') updateStick(x, y);
      else {
        look.dx += (x - tc.x) * o.lookScale;
        look.dy += (y - tc.y) * o.lookScale;
      }
      if (!tc.moved && Math.hypot(x - tc.sx, y - tc.sy) > o.tapMove) tc.moved = true;
      tc.x = x; tc.y = y;
    },
    end(id, x, y, time) {
      const tc = touches.get(id);
      if (!tc) return null;
      touches.delete(id);
      if (tc.kind === 'stick') {
        stickId = null;
        state.stick.active = false;
        state.moveX = 0; state.moveY = 0; state.mag = 0; state.sprint = false;
        return 'stick';
      }
      if (tc.kind === 'bark') {
        if (![...touches.values()].some((v) => v.kind === 'bark')) state.barkHeld = false;
        return 'bark';
      }
      const ex = x ?? tc.x, ey = y ?? tc.y;
      const quick = time - tc.t0 <= o.tapTime;
      const still = !tc.moved && Math.hypot(ex - tc.sx, ey - tc.sy) <= o.tapMove;
      if (quick && still) {
        edges.jump = true;
        lastTapEnd = time; lastTapX = ex; lastTapY = ey;
        return 'tap';
      }
      return 'look';
    },
    cancel(id) { api.end(id, undefined, undefined, Infinity); },
    sigDown() { edges.sig = true; state.sigHeld = true; },
    sigUp() { state.sigHeld = false; },
    reset() {
      touches.clear(); stickId = null;
      state.stick.active = false;
      state.moveX = state.moveY = state.mag = 0;
      state.sprint = state.barkHeld = state.sigHeld = false;
      edges.jump = edges.bark = edges.sig = false;
      look.dx = look.dy = 0;
    },
    // Latched edges since the last call.
    consumeEdges() {
      state.jump = edges.jump; state.bark = edges.bark; state.sig = edges.sig;
      edges.jump = edges.bark = edges.sig = false;
      return state;
    },
    consumeLook() {
      lookOut.dx = look.dx; lookOut.dy = look.dy;
      look.dx = 0; look.dy = 0;
      return lookOut;
    },
    get activeCount() { return touches.size; },
  };
  return api;
}

// The paw: one big pad and four toe beans.
export const PAW_SVG = '<svg viewBox="0 0 100 100" width="58%" height="58%" aria-hidden="true" focusable="false">'
  + '<g fill="#fffaf2" stroke="rgba(58,42,34,0.55)" stroke-width="3">'
  + '<path d="M50 50c-13 0-25 12-27 23-2 9 5 14 13 13 5-1 9-3 14-3s9 2 14 3c8 1 15-4 13-13-2-11-14-23-27-23z"/>'
  + '<ellipse cx="25" cy="44" rx="8.5" ry="11" transform="rotate(-18 25 44)"/>'
  + '<ellipse cx="40" cy="27" rx="9" ry="12" transform="rotate(-6 40 27)"/>'
  + '<ellipse cx="60" cy="27" rx="9" ry="12" transform="rotate(6 60 27)"/>'
  + '<ellipse cx="75" cy="44" rx="8.5" ry="11" transform="rotate(18 75 44)"/>'
  + '</g></svg>';

const CSS = `
.gp-touch{position:fixed;inset:0;pointer-events:none;z-index:40;display:none;--u:max(3.6px,min(1vh,0.55vw));}
.gp-touch.on{display:block;}
.gp-touch .gp-stick{position:absolute;left:0;top:0;border-radius:50%;opacity:0;transition:opacity .12s;
  background:radial-gradient(circle,rgba(255,255,255,.10) 0,rgba(255,255,255,.18) 70%,rgba(255,255,255,.28) 100%);
  box-shadow:0 0 0 2px rgba(255,255,255,.35),0 2px 10px rgba(0,0,0,.18);}
.gp-touch .gp-knob{position:absolute;left:0;top:0;border-radius:50%;opacity:0;transition:opacity .12s;
  background:rgba(255,255,255,.75);box-shadow:0 2px 8px rgba(0,0,0,.25);}
.gp-touch.stick .gp-stick{opacity:1;} .gp-touch.stick .gp-knob{opacity:1;}
.gp-touch.zoom .gp-knob{background:rgba(255,214,120,.9);}
.gp-touch .gp-sig{position:absolute;pointer-events:auto;touch-action:none;border:0;padding:0;margin:0;border-radius:50%;
  width:max(64px,calc(var(--u)*16));height:max(64px,calc(var(--u)*16));
  right:calc(max(18px,calc(var(--u)*5)) + env(safe-area-inset-right,0px));
  bottom:calc(max(18px,calc(var(--u)*5)) + env(safe-area-inset-bottom,0px));
  display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 40% 35%,rgba(255,150,120,.95),rgba(232,96,78,.92));
  box-shadow:0 0 0 3px rgba(255,255,255,.55),0 4px 14px rgba(0,0,0,.25);
  -webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;transition:transform .08s;}
.gp-touch .gp-sig.down{transform:scale(.9);}
`;

const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="slider"], [data-no-touch], [contenteditable]';

export function isTouchDevice(win = globalThis) {
  try {
    if (win.matchMedia && win.matchMedia('(pointer: coarse)').matches) return true;
    if ((win.navigator?.maxTouchPoints || 0) > 0 && 'ontouchstart' in win) return true;
  } catch { /* ignore */ }
  return false;
}

// DOM wiring. Returns { gestures, setVisible, setAuto, refresh, dispose, el }.
export function createTouchControls({ win = globalThis, settings, onActivity } = {}) {
  const doc = win.document;
  const gestures = createTouchGestures();
  if (!doc || !doc.createElement) {
    return { gestures, setVisible() {}, setAuto() {}, refresh() {}, dispose() {}, el: null, get active() { return false; } };
  }

  if (!doc.getElementById('gp-touch-css')) {
    const st = doc.createElement('style');
    st.id = 'gp-touch-css';
    st.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(st);
  }
  const el = doc.createElement('div');
  el.className = 'gp-touch';
  const stick = doc.createElement('div'); stick.className = 'gp-stick';
  const knob = doc.createElement('div'); knob.className = 'gp-knob';
  const sig = doc.createElement('button');
  sig.className = 'gp-sig';
  sig.type = 'button';
  sig.tabIndex = -1;
  sig.setAttribute('aria-label', t('meta.input.sig'));
  sig.innerHTML = PAW_SVG;
  el.append(stick, knob, sig);
  (doc.body || doc.documentElement).appendChild(el);

  let forced = null;      // setVisible() from the UI wins
  let auto = false;       // follows the run: on at intro/go/resume, off at pause/finish
  let seenTouch = isTouchDevice(win);
  const shown = () => seenTouch && (forced == null ? auto : forced);

  function refresh() {
    const on = shown();
    el.classList.toggle('on', on);
    if (!on) { gestures.reset(); el.classList.remove('stick', 'zoom'); sig.classList.remove('down'); }
  }

  function unit() {
    const u = Math.max(3.6, Math.min(win.innerHeight / 100, (0.55 * win.innerWidth) / 100));
    return u;
  }

  function drawStick() {
    const s = gestures.state.stick;
    if (!s.active) { el.classList.remove('stick', 'zoom'); return; }
    const r = gestures.options.stickRadius;
    const kr = r * 0.42;
    stick.style.width = stick.style.height = `${r * 2}px`;
    stick.style.transform = `translate(${s.ox - r}px, ${s.oy - r}px)`;
    knob.style.width = knob.style.height = `${kr * 2}px`;
    const kx = s.ox + gestures.state.moveX * r, ky = s.oy - gestures.state.moveY * r;
    knob.style.transform = `translate(${kx - kr}px, ${ky - kr}px)`;
    el.classList.add('stick');
    el.classList.toggle('zoom', gestures.state.sprint);
  }

  const now = () => (win.performance?.now?.() ?? Date.now()) / 1000;
  const blocked = (target) => {
    if (target === sig || (sig.contains && sig.contains(target))) return true;
    return !!(target && target.closest && target.closest(INTERACTIVE));
  };

  function onStart(e) {
    if (!seenTouch) { seenTouch = true; refresh(); }
    onActivity && onActivity();
    if (!shown()) return;
    let handled = false;
    for (const tc of e.changedTouches) {
      if (blocked(tc.target)) continue;
      gestures.setOptions({ stickRadius: Math.max(44, unit() * 11) });
      const side = tc.clientX < win.innerWidth * 0.5 ? 'left' : 'right';
      gestures.start(tc.identifier, tc.clientX, tc.clientY, now(), side);
      handled = true;
    }
    if (handled) { if (e.cancelable) e.preventDefault(); drawStick(); }
  }
  function onMove(e) {
    if (!shown()) return;
    let handled = false;
    for (const tc of e.changedTouches) { gestures.move(tc.identifier, tc.clientX, tc.clientY); handled = true; }
    if (handled && gestures.activeCount && e.cancelable) e.preventDefault();
    drawStick();
  }
  function onEnd(e) {
    for (const tc of e.changedTouches) gestures.end(tc.identifier, tc.clientX, tc.clientY, now());
    drawStick();
  }
  function onCancel(e) {
    for (const tc of e.changedTouches) gestures.cancel(tc.identifier);
    drawStick();
  }
  function sigDown(e) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    onActivity && onActivity();
    gestures.sigDown();
    sig.classList.add('down');
  }
  function sigUp(e) {
    if (e && e.cancelable) e.preventDefault();
    gestures.sigUp();
    sig.classList.remove('down');
  }

  const opt = { passive: false };
  win.addEventListener('touchstart', onStart, opt);
  win.addEventListener('touchmove', onMove, opt);
  win.addEventListener('touchend', onEnd, opt);
  win.addEventListener('touchcancel', onCancel, opt);
  sig.addEventListener('touchstart', sigDown, opt);
  sig.addEventListener('touchend', sigUp, opt);
  sig.addEventListener('touchcancel', sigUp, opt);
  sig.addEventListener('contextmenu', (e) => e.preventDefault());
  refresh();

  return {
    gestures,
    el,
    get active() { return shown(); },
    setVisible(v) { forced = v == null ? null : !!v; refresh(); },
    setAuto(v) { auto = !!v; refresh(); },
    refresh,
    dispose() {
      win.removeEventListener('touchstart', onStart, opt);
      win.removeEventListener('touchmove', onMove, opt);
      win.removeEventListener('touchend', onEnd, opt);
      win.removeEventListener('touchcancel', onCancel, opt);
      el.remove();
    },
  };
}
