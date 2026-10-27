// Fake browser bits for driving createInput in Node.
export function fakeTarget() {
  const map = new Map();
  return {
    addEventListener(type, fn) { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); },
    removeEventListener(type, fn) { map.get(type)?.delete(fn); },
    fire(type, ev) { for (const fn of map.get(type) || []) fn(ev); },
    count(type) { return map.get(type)?.size || 0; },
  };
}

export function fakeEnv() {
  const win = fakeTarget();
  const doc = fakeTarget();
  const body = { tagName: 'BODY', closest: () => null };
  doc.activeElement = body;
  doc.hidden = false;
  win.document = doc;
  win.innerWidth = 1280;
  win.innerHeight = 720;
  let pads = [];
  win.navigator = { getGamepads: () => pads };
  let t = 0;
  const clock = () => t;
  const element = fakeTarget();
  element.tagName = 'BODY';
  return {
    win, doc, body, element, clock,
    advance(s) { t += s; },
    setPads(p) { pads = p; },
    key(type, code, o = {}) {
      const ev = {
        code, key: o.key ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : code), repeat: !!o.repeat,
        target: o.target || doc.activeElement, ctrlKey: !!o.ctrl, metaKey: false, altKey: false, cancelable: true,
        defaultPrevented: false, preventDefault() { this.defaultPrevented = true; },
      };
      win.fire(type, ev);
      return ev;
    },
    tap(code, o) { this.key('keydown', code, o); return this.key('keyup', code, o); },
    pointer(type, o = {}) {
      const canvas = { tagName: 'CANVAS', closest: () => null, setPointerCapture() {} };
      element.fire(type, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: 0, clientY: 0, target: canvas, preventDefault() {}, ...o });
    },
  };
}

export function fakePad(o = {}) {
  const buttons = Array.from({ length: 18 }, () => ({ pressed: false, value: 0 }));
  for (const i of o.pressed || []) buttons[i] = { pressed: true, value: 1 };
  return { connected: true, timestamp: o.timestamp ?? 1, buttons, axes: o.axes || [0, 0, 0, 0], mapping: 'standard' };
}
