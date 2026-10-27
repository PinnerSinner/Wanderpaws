// Input: keyboard (rebindable), gamepad (standard mapping), mouse drag look and
// touch, merged into one Raw frame per sim tick. See CONTRACTS §8.
//
// Nothing here touches the DOM at import time, and createInput accepts a fake
// `win` so Node tests can drive it with synthetic events.
//
// Notes for callers:
// - poll() once per sim tick. Edges (jump, sig, bark, pause, photo, confirm,
//   cancel) are latched from the event until the next poll, so a tap shorter
//   than a tick is never lost.
// - consumeLook() once per animation frame. dx > 0 means look right, dy > 0
//   means look down (invertY flips dy). Units are radians-ish.
// - onMenu(fn) calls fn(action, info) with info = { source: 'kb'|'pad', repeat,
//   native } where native is true when the browser will also activate the
//   focused element itself (a focused <button> on Enter), so the UI can skip
//   its own activation and avoid a double click.
// - setEnabled(false) zeroes movement, actions and look, but pause, confirm,
//   cancel, menu, text and Konami events keep flowing (menus still work).
// - Nothing is reported, and no default is prevented, while a text field is focused.

import { EV } from '../core/events.js';
import { resolveBindings, indexBindings, rebindAction, isPadCode, ACTIONS } from './bindings.js';
import { radialDeadzone, buttonPressed, padDirection, pickPad, padActive, PAD } from './pad.js';
import { createKonami, keyToken, padToken, KONAMI_TOKEN } from './konami.js';
import { createRepeater, MENU_KEYS, MENU_EDGE_KEYS, MENU_PAD, isTextTarget, isNativeActivator, textChar } from './menu.js';
import { createTouchControls, isTouchDevice } from './touch.js';

export { DEFAULT_BINDINGS, ACTIONS, ONE_HANDED_EXTRA } from './bindings.js';
export { KONAMI_TOKEN } from './konami.js';

const MOUSE_LOOK = 0.0045;   // radians-ish per px
const KEY_LOOK_RATE = 2.4;   // per second at full deflection
const PAD_LOOK_RATE = 3.0;
const PAD_BUTTONS = 18;
const LOOK_SURFACE = '[data-look-surface], #float';
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [role="slider"], [role="tab"], [data-no-look], [contenteditable]';
const CONFIRM_CODES = ['Enter', 'NumpadEnter'];
const CANCEL_CODES = ['Escape', 'Backspace'];

export function createInput({ element, settings, bus, win = globalThis, now } = {}) {
  const clock = now || (() => ((win.performance && win.performance.now) ? win.performance.now() : Date.now()) / 1000);
  const get = (k, d) => { const v = settings && settings.get ? settings.get(k) : undefined; return v == null ? d : v; };
  const doc = win.document || null;

  // ---------- state ----------
  let bindings = null, idx = null;
  function rebuild() {
    bindings = resolveBindings(get('bindings', null), !!get('oneHanded', false));
    idx = indexBindings(bindings);
  }
  rebuild();
  const unsub = settings && settings.subscribe ? settings.subscribe((k) => { if (k === 'bindings' || k === 'oneHanded') rebuild(); }) : null;

  const keys = new Set();
  const keyEdges = new Set();
  const padNow = new Array(PAD_BUTTONS).fill(false);
  const padEdge = new Array(PAD_BUTTONS).fill(false);
  const padMove = { x: 0, y: 0, mag: 0 };
  const padLook = { x: 0, y: 0, mag: 0 };
  const look = { dx: 0, dy: 0 };
  const lookOut = { dx: 0, dy: 0 };
  let lastLookT = clock();
  let enabled = true;
  let device = isTouchDevice(win) ? 'touch' : 'kb';
  let capture = null;          // rebinding: next key or pad button goes here
  let kbArrows = [];           // held arrow codes, most recent last
  let drag = null;             // mouse drag look { id, x, y }
  let seek = null;             // one-handed hold-to-move toward the pointer { id, x, y }
  const mouseEdges = { jump: false, sig: false };
  let mouseSig = false;

  const textFns = new Set(), konamiFns = new Set(), menuFns = new Set();
  const konami = createKonami();
  const kbRep = createRepeater();
  const padRep = createRepeater();

  const raw = {
    moveX: 0, moveY: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false,
    bark: false, barkHeld: false, pause: false, photo: false, confirm: false, cancel: false, menuX: 0, menuY: 0,
  };

  const touch = createTouchControls({ win, settings, onActivity: () => setDevice('touch') });

  // ---------- helpers ----------
  function setDevice(d) {
    if (device === d) return;
    device = d;
    if (bus && bus.emit) bus.emit('inputDevice', { type: 'inputDevice', device: d });
  }
  const focused = () => (doc ? doc.activeElement : null);
  const textFocused = (target) => isTextTarget(target) || isTextTarget(focused());

  function fireMenu(action, source, repeat = false) {
    if (!action || textFocused(null)) return;
    const info = { source, repeat, native: action === 'confirm' && source === 'kb' && isNativeActivator(focused()) };
    for (const fn of menuFns) { try { fn(action, info); } catch (e) { console.error('[input] onMenu', e); } }
  }
  function fireText(ch) { for (const fn of textFns) { try { fn(ch); } catch (e) { console.error('[input] onText', e); } } }
  function pushKonami(tok) {
    if (!tok || !konami.push(tok)) return;
    for (const fn of konamiFns) { try { fn(KONAMI_TOKEN); } catch (e) { console.error('[input] onKonami', e); } }
  }
  const kbDir = () => (kbArrows.length ? MENU_KEYS[kbArrows[kbArrows.length - 1]] : null);

  function held(codes) {
    for (const c of codes) {
      if (isPadCode(c)) { if (padNow[+c.slice(3)]) return true; }
      else if (keys.has(c)) return true;
    }
    return false;
  }
  function edged(codes) {
    for (const c of codes) {
      if (isPadCode(c)) { if (padEdge[+c.slice(3)]) return true; }
      else if (keyEdges.has(c)) return true;
    }
    return false;
  }
  const anyKeyEdge = (list) => list.some((c) => keyEdges.has(c));

  // ---------- keyboard ----------
  function onKeyDown(e) {
    const code = e.code || '';
    if (textFocused(e.target)) return;
    if (capture && !e.repeat) {
      const fn = capture; capture = null;
      if (e.cancelable && e.preventDefault) e.preventDefault();
      fn(code === 'Escape' ? null : code);
      return;
    }
    setDevice('kb');
    if (!e.repeat) {
      if (!keys.has(code)) keyEdges.add(code);
      const md = MENU_KEYS[code];
      if (md) {
        kbArrows = kbArrows.filter((c) => c !== code);
        kbArrows.push(code);
        fireMenu(kbRep.update(md, clock()), 'kb');
      }
      const me = MENU_EDGE_KEYS[code];
      if (me) fireMenu(me, 'kb');
      pushKonami(keyToken(code));
      const ch = textChar(e);
      if (ch) fireText(ch);
    }
    keys.add(code);
    // Stop arrows and Space scrolling the page, but let the browser keep its
    // shortcuts and its own activation of focused buttons.
    const bound = idx.has(code) || !!MENU_KEYS[code];
    const shortcut = e.ctrlKey || e.metaKey;
    const nativeAct = (code === 'Space' || code === 'Enter') && isNativeActivator(e.target);
    if (bound && !shortcut && !nativeAct && e.cancelable !== false && e.preventDefault) e.preventDefault();
  }
  function onKeyUp(e) {
    const code = e.code || '';
    keys.delete(code);
    if (MENU_KEYS[code]) {
      kbArrows = kbArrows.filter((c) => c !== code);
      // Falling back to an older held arrow re-arms the repeat without firing.
      kbRep.update(null, clock());
      const d = kbDir();
      if (d) { kbRep.update(d, clock()); }
    }
  }
  function clearHeld() {
    keys.clear(); kbArrows = []; kbRep.reset(); drag = null; seek = null; mouseSig = false;
    touch.gestures.reset();
  }

  // ---------- mouse ----------
  function lookAllowed(target) {
    if (!target) return false;
    if (target.closest && target.closest(INTERACTIVE)) return false;
    const tag = String(target.tagName || '').toUpperCase();
    if (tag === 'CANVAS' || tag === 'BODY' || tag === 'HTML' || target === element) return true;
    return !!(target.closest && target.closest(LOOK_SURFACE));
  }
  function onPointerDown(e) {
    if (e.pointerType === 'touch') return;
    if (!lookAllowed(e.target)) return;
    setDevice('kb');
    const oneHanded = !!get('oneHanded', false);
    if (oneHanded) {
      if (e.button === 0) seek = { id: e.pointerId, x: e.clientX, y: e.clientY };
      else if (e.button === 2) mouseEdges.jump = true;
      else if (e.button === 1) { mouseEdges.sig = true; mouseSig = true; }
    } else {
      if (e.button === 0 || e.button === 2) drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      else if (e.button === 1) { mouseEdges.sig = true; mouseSig = true; }
    }
    try { if (e.target && e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }
  function onPointerMove(e) {
    if (drag && e.pointerId === drag.id) {
      const sens = get('lookSensitivity', 1);
      look.dx += (e.clientX - drag.x) * MOUSE_LOOK * sens;
      look.dy += (e.clientY - drag.y) * MOUSE_LOOK * sens;
      drag.x = e.clientX; drag.y = e.clientY;
    }
    if (seek && e.pointerId === seek.id) { seek.x = e.clientX; seek.y = e.clientY; }
  }
  function onPointerUp(e) {
    if (drag && e.pointerId === drag.id) drag = null;
    if (seek && e.pointerId === seek.id) seek = null;
    if (e.button === 1) mouseSig = false;
  }
  function onContextMenu(e) {
    if (lookAllowed(e.target) && e.preventDefault) e.preventDefault();
  }
  function onBlur() { clearHeld(); }
  function onVisibility() { if (doc && doc.hidden) clearHeld(); }

  const target = element || win;
  if (win.addEventListener) {
    win.addEventListener('keydown', onKeyDown);
    win.addEventListener('keyup', onKeyUp);
    win.addEventListener('blur', onBlur);
  }
  if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisibility);
  if (target && target.addEventListener) {
    target.addEventListener('pointerdown', onPointerDown);
    target.addEventListener('pointermove', onPointerMove);
    target.addEventListener('pointerup', onPointerUp);
    target.addEventListener('pointercancel', onPointerUp);
    target.addEventListener('contextmenu', onContextMenu);
  }

  // Touch controls follow the run unless the UI says otherwise.
  const busOffs = [];
  if (bus && bus.on) {
    for (const ev of [EV.INTRO, EV.GO, EV.RESUME]) busOffs.push(bus.on(ev, () => touch.setAuto(true)));
    for (const ev of [EV.PAUSE, EV.FINISH]) busOffs.push(bus.on(ev, () => touch.setAuto(false)));
  }

  // ---------- gamepad ----------
  let padWasConnected = false;
  let padDir = null;
  function pollPad(t) {
    const nav = win.navigator;
    let gp = null;
    if (nav && nav.getGamepads) {
      try { gp = pickPad(nav.getGamepads()); } catch { gp = null; }
    }
    if (!gp) {
      if (padWasConnected) { padNow.fill(false); padMove.x = padMove.y = padMove.mag = 0; padLook.x = padLook.y = padLook.mag = 0; padRep.reset(); }
      padWasConnected = false;
      padDir = null;
      return;
    }
    padWasConnected = true;
    const btn = gp.buttons || [];
    const text = textFocused(null);
    for (let i = 0; i < PAD_BUTTONS; i++) {
      const p = buttonPressed(btn[i], i === PAD.LT || i === PAD.RT ? 0.35 : 0.5);
      if (p && !padNow[i]) {
        if (capture) { const fn = capture; capture = null; fn('Pad' + i); padNow[i] = p; continue; }
        padEdge[i] = true;
        if (!text) {
          if (MENU_PAD[i]) fireMenu(MENU_PAD[i], 'pad');
          pushKonami(padToken(i));
        }
      }
      padNow[i] = p;
    }
    const ax = gp.axes || [];
    const dz = get('padDeadzone', 0.15);
    const curve = get('padCurve', 1.6);
    radialDeadzone(ax[0] || 0, ax[1] || 0, dz, 0.95, curve, padMove);
    radialDeadzone(ax[2] || 0, ax[3] || 0, dz, 0.95, Math.max(1, curve + 0.2), padLook);
    if (padActive(gp)) setDevice('pad');
    const dir = text ? null : padDirection(gp);
    padDir = dir;
    const fire = padRep.update(dir, t);
    if (fire) fireMenu(fire, 'pad', false);
  }

  // ---------- per tick ----------
  function poll() {
    const t = clock();
    pollPad(t);
    const rep = kbRep.update(kbDir(), t);
    if (rep) fireMenu(rep, 'kb', true);
    const tg = touch.gestures.consumeEdges();

    const oneHanded = !!get('oneHanded', false);
    // Movement: keys, then pad stick, then touch stick, then pointer seek.
    let mx = (held(bindings.right) ? 1 : 0) - (held(bindings.left) ? 1 : 0);
    let my = (held(bindings.up) ? 1 : 0) - (held(bindings.down) ? 1 : 0);
    mx += padMove.x; my -= padMove.y;
    mx += tg.moveX; my += tg.moveY;
    if (seek) {
      const cx = (win.innerWidth || 0) / 2, cy = (win.innerHeight || 0) / 2;
      const r = Math.max(40, Math.min(win.innerWidth || 0, win.innerHeight || 0) * 0.25);
      mx += (seek.x - cx) / r; my -= (seek.y - cy) / r;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }

    const ok = enabled;
    raw.moveX = ok ? mx : 0;
    raw.moveY = ok ? my : 0;
    raw.sprint = ok && (held(bindings.sprint) || tg.sprint || oneHanded || !!get('autoSprint', false));
    raw.jump = ok && (edged(bindings.jump) || tg.jump || mouseEdges.jump);
    raw.jumpHeld = ok && (held(bindings.jump) || raw.jump);
    raw.sig = ok && (edged(bindings.sig) || tg.sig || mouseEdges.sig);
    raw.sigHeld = ok && (held(bindings.sig) || tg.sigHeld || mouseSig || raw.sig);
    raw.bark = ok && (edged(bindings.bark) || tg.bark);
    raw.barkHeld = ok && (held(bindings.bark) || tg.barkHeld || raw.bark);
    raw.photo = ok && edged(bindings.photo);
    raw.pause = edged(bindings.pause);
    raw.confirm = anyKeyEdge(CONFIRM_CODES) || padEdge[PAD.A];
    raw.cancel = anyKeyEdge(CANCEL_CODES) || padEdge[PAD.B];
    const md = kbDir() || padDir;
    raw.menuX = md === 'left' ? -1 : md === 'right' ? 1 : 0;
    raw.menuY = md === 'up' ? 1 : md === 'down' ? -1 : 0;

    keyEdges.clear();
    padEdge.fill(false);
    mouseEdges.jump = mouseEdges.sig = false;
    return raw;
  }

  // ---------- per frame ----------
  function consumeLook() {
    const t = clock();
    const dt = Math.max(0, Math.min(0.1, t - lastLookT));
    lastLookT = t;
    const sens = get('lookSensitivity', 1);
    const kx = (held(bindings.lookRight) ? 1 : 0) - (held(bindings.lookLeft) ? 1 : 0);
    const ky = (held(bindings.lookDown) ? 1 : 0) - (held(bindings.lookUp) ? 1 : 0);
    let dx = look.dx + (kx * KEY_LOOK_RATE + padLook.x * PAD_LOOK_RATE) * dt * sens;
    let dy = look.dy + (ky * KEY_LOOK_RATE + padLook.y * PAD_LOOK_RATE) * dt * sens;
    const tl = touch.gestures.consumeLook();
    dx += tl.dx * sens; dy += tl.dy * sens;
    look.dx = 0; look.dy = 0;
    const inv = get('invertY', false) ? -1 : 1;
    lookOut.dx = enabled ? dx : 0;
    lookOut.dy = enabled ? dy * inv : 0;
    return lookOut;
  }

  const api = {
    poll,
    consumeLook,
    onText(fn) { textFns.add(fn); return () => textFns.delete(fn); },
    onKonami(fn) { konamiFns.add(fn); return () => konamiFns.delete(fn); },
    onMenu(fn) { menuFns.add(fn); return () => menuFns.delete(fn); },
    get device() { return device; },
    get enabled() { return enabled; },
    setEnabled(v) { enabled = !!v; if (!enabled) { look.dx = look.dy = 0; } },
    rebind(action, code) {
      if (!ACTIONS.includes(action)) return api.bindings();
      const next = rebindAction(get('bindings', null) || {}, action, code);
      if (settings && settings.set) settings.set('bindings', next);
      rebuild();
      return api.bindings();
    },
    resetBindings() { if (settings && settings.set) settings.set('bindings', null); rebuild(); return api.bindings(); },
    bindings() {
      const out = {};
      for (const a of ACTIONS) out[a] = bindings[a].slice();
      return out;
    },
    // For the controls page: the next key (KeyboardEvent.code) or pad button
    // ('Pad<n>') goes to fn instead of the game. Escape gives fn(null).
    captureNext(fn) { capture = fn; return () => { if (capture === fn) capture = null; }; },
    touch: {
      setVisible(v) { touch.setVisible(v); },
      get visible() { return touch.active; },
    },
    dispose() {
      if (win.removeEventListener) {
        win.removeEventListener('keydown', onKeyDown);
        win.removeEventListener('keyup', onKeyUp);
        win.removeEventListener('blur', onBlur);
      }
      if (doc && doc.removeEventListener) doc.removeEventListener('visibilitychange', onVisibility);
      if (target && target.removeEventListener) {
        target.removeEventListener('pointerdown', onPointerDown);
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
        target.removeEventListener('pointercancel', onPointerUp);
        target.removeEventListener('contextmenu', onContextMenu);
      }
      for (const off of busOffs) if (typeof off === 'function') off();
      if (unsub) unsub();
      touch.dispose();
    },
  };
  return api;
}
