// STUB (lead): replaced by the Meta and input agent.
export function createInput() {
  const keys = new Set(); const edge = new Set();
  addEventListener('keydown', (e) => { if (!keys.has(e.code)) edge.add(e.code); keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  const raw = { moveX: 0, moveY: 0, sprint: false, jump: false, jumpHeld: false, sig: false, sigHeld: false, bark: false, barkHeld: false, pause: false, photo: false, confirm: false, cancel: false, menuX: 0, menuY: 0 };
  return { poll() { const k = (c) => keys.has(c);
      raw.moveX = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
      raw.moveY = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
      raw.sprint = k('ShiftLeft'); raw.jump = edge.has('Space'); raw.jumpHeld = k('Space'); raw.pause = k('Escape');
      edge.clear(); return raw; },
    consumeLook: () => ({ dx: 0, dy: 0 }), onText() {}, onKonami() {}, device: 'kb', setEnabled() {}, rebind() {}, bindings: () => ({}), touch: { setVisible() {} } };
}
