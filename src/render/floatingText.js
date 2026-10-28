// Floating text: small white words with a soft dark outline, positioned each
// frame over their speaker. Never boxes, never bubbles. Labels fade in and
// out, float up gently, keep off each other, off the player's animal and off
// the HUD corners, and stay inside the safe area.

import { createLayout, clearLayout, addLabel, addAvoid, resolveLayout, edgeFade, defaultTtl } from './pure/textLayout.js';

const STYLE_ID = 'gp-ft-style';
const CSS = `
#float { --gpu: max(3.6px, min(1vh, 0.55vw)); }
.gp-ft { position: absolute; left: 0; top: 0; transform: translate3d(-9999px, 0, 0); opacity: 0;
  color: #fff; text-align: center; white-space: pre-line; max-width: min(46ch, 60vw);
  font-family: "Nunito", "Varela Round", ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif;
  font-weight: 800; line-height: 1.12; letter-spacing: 0.01em;
  font-size: calc(max(14px, var(--gpu) * 2.4) * var(--gpts, 1));
  text-shadow: 0 0 0.16em rgba(38, 24, 32, 0.95), 0 0.05em 0.12em rgba(38, 24, 32, 0.85), 0 0 0.55em rgba(38, 24, 32, 0.4);
  will-change: transform, opacity; pointer-events: none; user-select: none; }
.gp-ft .gp-sub { display: block; font-size: 0.7em; font-weight: 700; opacity: 0.9; margin-top: 0.12em; font-style: normal; }
.gp-ft.thought { font-style: italic; font-weight: 700; }
.gp-ft.item { font-size: calc(max(13px, var(--gpu) * 2.1) * var(--gpts, 1)); font-weight: 800; }
.gp-ft.big { font-size: calc(max(19px, var(--gpu) * 3.7) * var(--gpts, 1)); font-weight: 900; letter-spacing: 0.02em;
  text-shadow: 0 0 0.12em rgba(38, 24, 32, 0.95), 0 0.06em 0.1em rgba(38, 24, 32, 0.9), 0 0 0.5em rgba(255, 170, 90, 0.45); }
`;

const PRIO = { big: 4, chatter: 2, thought: 2.2, item: 1 };
const FADE_IN = 0.22, FADE_OUT = 0.45;

export function createFloatingText({ overlay, settings, max = 12 }) {
  const enabled = !!(overlay && typeof document !== 'undefined');
  if (enabled && !document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const entries = [];
  for (let i = 0; i < max && enabled; i++) {
    const el = document.createElement('div');
    el.className = 'gp-ft';
    el.style.display = 'none';
    const txt = document.createElement('span');
    const sub = document.createElement('span');
    sub.className = 'gp-sub';
    el.appendChild(txt);
    el.appendChild(sub);
    overlay.appendChild(el);
    entries.push({
      el, txt, sub, active: false, age: 0, ttl: 2, w: 0, h: 0, x: 0, y: 0, placed: false,
      speaker: '', style: 'chatter', fixed: false, anchor: null, ax: 0, ay: 0, az: 0, visible: false, slot: -1,
      lastT: '', lastO: -1, dying: false,
    });
  }
  const L = createLayout(max);
  const safe = { l: 0, t: 0, r: 0, b: 0 };
  const scr = { x: 0, y: 0, behind: false };
  const world = { x: 0, y: 0, z: 0 };
  let textScale = 1;

  function applyScale() {
    textScale = Math.max(0.8, Math.min(1.6, settings?.get?.('textScale') || 1));
    if (enabled) overlay.style.setProperty('--gpts', String(textScale));
  }
  applyScale();
  const unsub = settings?.subscribe?.((k) => { if (k === 'textScale') { applyScale(); for (const e of entries) if (e.active) measure(e); } });

  function measure(e) {
    e.el.style.transform = 'translate3d(-9999px,0,0)';
    e.w = e.el.offsetWidth || 100;
    e.h = e.el.offsetHeight || 24;
  }

  function add(line) {
    if (!enabled || !line || !line.text) return;
    const style = line.style || 'chatter';
    const anchor = line.anchor ?? 'player';
    // the same speaker replaces their previous line straight away
    for (const e of entries) {
      if (e.active && !e.dying && e.speaker && e.speaker === line.speaker && sameAnchor(e.anchor, anchor)) { e.dying = true; e.ttl = Math.min(e.ttl, e.age); }
    }
    let e = entries.find((x) => !x.active);
    if (!e) {
      // recycle the oldest non-big line
      e = entries.reduce((a, b) => (b.style !== 'big' && (a.style === 'big' || b.age - b.ttl > a.age - a.ttl) ? b : a), entries[0]);
    }
    e.active = true; e.dying = false; e.age = 0; e.placed = false; e.visible = false;
    e.style = style; e.speaker = line.speaker || ''; e.anchor = anchor;
    // milestones and the narrator sit in the upper third, keeping the middle clear
    e.fixed = style === 'big' || e.speaker === 'narrator';
    if (anchor && typeof anchor === 'object') { e.ax = anchor.x || 0; e.ay = anchor.y || 0; e.az = anchor.z || 0; }
    e.el.className = 'gp-ft ' + style;
    e.txt.textContent = line.text;
    const showSub = !!(line.sub && settings?.get?.('translatePt') !== false && (line.lang === 'pt-BR' || line.lang == null));
    e.sub.textContent = showSub ? line.sub : '';
    e.sub.style.display = showSub ? 'block' : 'none';
    e.el.style.display = 'block';
    e.el.style.opacity = '0';
    e.lastO = 0; e.lastT = '';
    measure(e);
    e.ttl = line.ttl > 0 ? line.ttl : defaultTtl(line.text + (showSub ? line.sub : ''), style);
  }

  function clear() {
    for (const e of entries) { e.active = false; e.el.style.display = 'none'; }
  }

  // ctx: { width, height, project(x, y, z, out) -> out {x, y, behind}, resolve(anchor, style, out) -> bool,
  //        playerRect: {l, t, r, b} | null, visible }
  function update(dt, ctx) {
    if (!enabled) return;
    const W = ctx.width, H = ctx.height;
    const u = Math.max(3.6, Math.min(H, 0.55 * W) / 100);
    safe.l = W * 0.025 + (ctx.insetL || 0); safe.r = W * 0.975 - (ctx.insetR || 0);
    safe.t = H * 0.03 + (ctx.insetT || 0); safe.b = H * 0.94 - (ctx.insetB || 0);
    clearLayout(L);
    // HUD corners: size badge (top-left), goal and stars (top-right), timer (top-centre)
    addAvoid(L, 0, 0, u * 26, u * 30);
    addAvoid(L, W - u * 30, 0, W, u * 12);
    addAvoid(L, W * 0.5 - u * 12, 0, W * 0.5 + u * 12, u * 10);
    if (ctx.playerRect) addAvoid(L, ctx.playerRect.l, ctx.playerRect.t, ctx.playerRect.r, ctx.playerRect.b);

    for (const e of entries) {
      if (!e.active) continue;
      e.age += dt;
      if (e.age > e.ttl + FADE_OUT) { e.active = false; e.el.style.display = 'none'; e.slot = -1; continue; }
      e.slot = -1;
      if (e.fixed) {
        const rise0 = Math.min(1, e.age / Math.max(0.5, e.ttl)) * u * 1.2;
        e.slot = addLabel(L, W * 0.5, H * 0.27 - rise0, e.w, e.h, 5);
        e.visible = e.slot >= 0;
        continue;
      }
      const ok = typeof e.anchor === 'object' && e.anchor
        ? (world.x = e.ax, world.y = e.ay, world.z = e.az, true)
        : ctx.resolve(e.anchor, e.style, world);
      if (!ok) { e.visible = false; continue; }
      ctx.project(world.x, world.y, world.z, scr);
      if (scr.behind) { e.visible = false; continue; }
      // gentle float upwards over the line's life
      const rise = Math.min(1, e.age / Math.max(0.5, e.ttl)) * u * (e.style === 'big' ? 3 : 2);
      const prio = (PRIO[e.style] || 1) + Math.min(1, e.age * 0.2);
      e.slot = addLabel(L, scr.x, scr.y - u * 0.8 - rise, e.w, e.h, prio);
      e.visible = e.slot >= 0;
    }
    resolveLayout(L, safe, u * 0.5);

    for (const e of entries) {
      if (!e.active) continue;
      let o = 0, sc = 1;
      if (e.visible && e.slot >= 0 && ctx.visible !== false) {
        const tx = L.ox[e.slot], ty = L.oy[e.slot];
        if (!e.placed) { e.x = tx; e.y = ty; e.placed = true; }
        else { const k = 1 - Math.exp(-14 * dt); e.x += (tx - e.x) * k; e.y += (ty - e.y) * k; }
        const fin = Math.min(1, e.age / FADE_IN);
        const fout = e.age > e.ttl ? Math.max(0, 1 - (e.age - e.ttl) / FADE_OUT) : 1;
        o = fin * fout * edgeFade(e.x, e.y, e.w, e.h, safe, u * 3);
        if (e.style === 'big') sc = 0.85 + 0.15 * easeOutBack(Math.min(1, e.age / 0.35));
        else sc = 0.94 + 0.06 * Math.min(1, e.age / FADE_IN);
      }
      const t = 'translate3d(' + (e.x - e.w * 0.5).toFixed(1) + 'px,' + (e.y - e.h).toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ')';
      if (t !== e.lastT) { e.el.style.transform = t; e.lastT = t; }
      const oq = Math.round(o * 100) / 100;
      if (oq !== e.lastO) { e.el.style.opacity = String(oq); e.lastO = oq; }
    }
  }

  return {
    add, update, clear,
    get active() { return entries.filter((e) => e.active).length; },
    dispose() { for (const e of entries) e.el.remove(); if (unsub) unsub(); },
  };
}

function sameAnchor(a, b) {
  if (a === b) return true;
  if (a && b && typeof a === 'object' && typeof b === 'object') return a.x === b.x && a.z === b.z;
  return false;
}

function easeOutBack(t) { const s = 1.70158; return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); }
