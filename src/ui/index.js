// STUB (lead): replaced by the UI agent.
export function createUI({ root, app }) {
  let current = null;
  return { get current() { return current; },
    show(screen) { current = screen; root.innerHTML = '';
      if (screen === 'title') { const b = document.createElement('button'); b.textContent = 'Play';
        b.style.cssText = 'position:absolute;right:10%;top:45%;font:800 6vh system-ui;padding:2vh 6vh;border-radius:4vh;border:0;background:#ff7a59;color:#fff';
        b.onclick = () => app.startRun({ worldId: 'w1', speciesId: 'oli' }); root.appendChild(b); } },
    frame() {}, onEvent() {} };
}
