// Key and pad bindings (pure, Node-testable). Codes are KeyboardEvent.code
// values ('KeyW', 'ArrowUp', 'Space') or pad buttons as 'Pad<n>' using the
// W3C standard mapping (Pad0 = A/cross, Pad1 = B/circle, Pad2 = X/square,
// Pad3 = Y/triangle, Pad4/5 = LB/RB, Pad6/7 = LT/RT, Pad8 = View, Pad9 = Start,
// Pad10/11 = stick clicks, Pad12..15 = d-pad up/down/left/right).

export const ACTIONS = [
  'up', 'down', 'left', 'right',
  'lookUp', 'lookDown', 'lookLeft', 'lookRight',
  'jump', 'sprint', 'sig', 'bark', 'photo', 'pause',
];

// SPEC §9 defaults.
export const DEFAULT_BINDINGS = Object.freeze({
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  lookUp: ['KeyI'],
  lookDown: ['KeyK'],
  lookLeft: ['KeyJ'],
  lookRight: ['KeyL'],
  jump: ['Space', 'Pad0'],
  sprint: ['ShiftLeft', 'ShiftRight', 'Pad7', 'Pad10'],
  sig: ['KeyE', 'Pad2', 'Pad5'],
  bark: ['KeyQ', 'Pad3'],
  photo: ['KeyP', 'Pad8'],
  pause: ['Escape', 'Pad9'],
});

// One-handed extras: everything reachable round the arrow keys (right hand)
// or round WASD (left hand), so neither hand needs the mouse.
export const ONE_HANDED_EXTRA = Object.freeze({
  jump: ['Slash', 'Numpad0', 'ControlRight', 'KeyF'],
  sig: ['Period', 'Numpad1', 'KeyR'],
  bark: ['Comma', 'Numpad2', 'KeyC'],
  photo: ['Semicolon'],
  pause: ['Backslash'],
  lookLeft: ['Delete', 'Numpad4'],
  lookRight: ['PageDown', 'Numpad6'],
  lookUp: ['Home', 'Numpad8'],
  lookDown: ['End', 'Numpad5'],
});

export const isPadCode = (code) => /^Pad\d+$/.test(code);

function cloneMap(m) {
  const out = {};
  for (const a of ACTIONS) out[a] = Array.isArray(m?.[a]) ? m[a].slice() : [];
  return out;
}

// Merge stored custom bindings over the defaults, plus one-handed extras.
// A custom entry is the action's full code list (keys and pad buttons); any
// code it claims is removed from the actions still on their defaults.
export function resolveBindings(custom, oneHanded = false) {
  const out = cloneMap(DEFAULT_BINDINGS);
  if (custom && typeof custom === 'object') {
    const claimed = new Set();
    for (const a of ACTIONS) {
      const c = custom[a];
      if (!Array.isArray(c)) continue;
      out[a] = [...new Set(c.filter((x) => typeof x === 'string' && x))];
      for (const code of out[a]) claimed.add(code);
    }
    for (const a of ACTIONS) if (!Array.isArray(custom[a])) out[a] = out[a].filter((x) => !claimed.has(x));
  }
  if (oneHanded) {
    for (const a in ONE_HANDED_EXTRA) for (const code of ONE_HANDED_EXTRA[a]) {
      if (ACTIONS.some((b) => out[b].includes(code))) continue;
      out[a].push(code);
    }
  }
  return out;
}

// Code -> [actions] lookup table.
export function indexBindings(map) {
  const idx = new Map();
  for (const a of ACTIONS) for (const code of map[a] || []) {
    if (!idx.has(code)) idx.set(code, []);
    idx.get(code).push(a);
  }
  return idx;
}

export function actionsForCode(map, code) {
  const out = [];
  for (const a of ACTIONS) if ((map[a] || []).includes(code)) out.push(a);
  return out;
}

// Rebind `action`'s primary code (of the same kind, key or pad) to `code`.
// If another action used `code`, it gets the old code instead (a swap), so no
// action is ever left unbound. Returns the new custom map to persist.
export function rebindAction(custom, action, code) {
  if (!ACTIONS.includes(action) || typeof code !== 'string' || !code) return custom || {};
  const map = resolveBindings(custom, false);
  const pad = isPadCode(code);
  const mine = map[action].filter((x) => isPadCode(x) === pad);
  const old = mine[0] || null;
  if (old === code) return { ...(custom || {}) };
  const next = { ...(custom || {}) };
  for (const b of ACTIONS) {
    if (b === action || !map[b].includes(code)) continue;
    const list = map[b].map((x) => (x === code ? old : x)).filter(Boolean);
    next[b] = [...new Set(list)];
  }
  const rest = mine.slice(1).filter((x) => x !== code);
  const other = map[action].filter((x) => isPadCode(x) !== pad);
  next[action] = [code, ...rest, ...other];
  return next;
}
