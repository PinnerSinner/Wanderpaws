// The UI: every screen, the HUD, toasts and menu navigation (mouse, touch,
// keyboard and pad). See CONTRACTS §9. DOM code lives here and in screens/;
// the maths it leans on is in logic.js (Node-tested).

import css from './styles.css';
import './copy.js';
import { t } from '../core/copy/index.js';
import { EV } from '../core/events.js';
import { createStorage } from '../core/storage.js';
import { h, clear } from './dom.js';
import { icon, ICONS } from './icons.js';
import {
  navPick, createActionDeduper, createCodeBuffer, createKonamiMatcher, createToastQueue,
  countUp, countUpDuration, clampScale,
} from './logic.js';
import { tk, safe, itemName, modName, speciesName, worldName, cosmeticName } from './data.js';
import { SCREENS } from './screens/index.js';
import { createHUD } from './hud.js';

const KEY_DIRS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const KEY_EDGE = { Enter: 'confirm', NumpadEnter: 'confirm', Escape: 'cancel', Backspace: 'cancel', KeyQ: 'tabPrev', KeyE: 'tabNext', PageUp: 'tabPrev', PageDown: 'tabNext', BracketLeft: 'tabPrev', BracketRight: 'tabNext' };
const KONAMI_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyB: 'b', KeyA: 'a' };
const RUN_SCREENS = new Set(['hud', 'pause', 'photo', 'end']);

function isText(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['button', 'checkbox', 'radio', 'range', 'file', 'submit'].includes(el.type));
}
const isNative = (el) => !!el && (el.tagName === 'BUTTON' || el.tagName === 'A' || (el.tagName === 'INPUT' && ['button', 'submit', 'checkbox', 'radio'].includes(el.type)));

export function createUI({ root, app }) {
  if (typeof document !== 'undefined' && !document.getElementById('gp-ui-css')) {
    document.head.appendChild(h('style', { id: 'gp-ui-css' }, css));
  }
  const store = createStorage();
  const settings = app.settings;
  const rootEl = h('div', { class: 'gp' });
  const screenLayer = h('div', { class: 'gp-layer' });
  const hudLayer = h('div', { class: 'gp-layer' });
  const fxLayer = h('div', { class: 'gp-layer', style: { pointerEvents: 'none' } });
  const toastWrap = h('div', { class: 'gp-toasts', 'aria-live': 'polite' });
  rootEl.append(hudLayer, screenLayer, fxLayer, toastWrap);
  root.appendChild(rootEl);

  let currentName = null;
  let cur = null;          // { name, el, ... }
  let hud = null;
  let hudRunKey = null;
  let modal = null;
  let sceneKey = 'title:' + (safe(() => app.profile.lastSpecies, 'oli'));
  const tweens = [];
  const toasts = createToastQueue({ max: 3, ttl: 2.6 });
  const liveToasts = new Map();
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  // ------------------------------------------------------------ settings -> classes
  function applySettings() {
    const s = (k, d) => safe(() => settings.get(k), d);
    rootEl.style.setProperty('--ts', String(clampScale(s('textScale', 1))));
    rootEl.style.setProperty('--hs', String(clampScale(s('hudScale', 1))));
    rootEl.classList.toggle('gp-rm', !!s('reducedMotion', false));
    rootEl.classList.toggle('gp-hc', !!s('highContrast', false));
    rootEl.dataset.cb = s('colourBlind', 'none');
  }
  applySettings();
  safe(() => settings.subscribe(() => applySettings()));

  // ------------------------------------------------------------ helpers for screens
  let lastTick = 0;
  const ctx = {
    app, t, store, now,
    get rootEl() { return rootEl; },
    get fxLayer() { return fxLayer; },
    sound(name) {
      if (name === 'tick' || name === 'count') { const n = now(); if (n - lastTick < 55) return; lastTick = n; }
      safe(() => app.uiSound(name));
    },
    show: (name, params) => show(name, params),
    get current() { return currentName; },
    toast,
    modal: openModal,
    closeModal,
    countUp: addCountUp,
    focusFirst,
    seen: {
      get(k) { return !!(store.get('uiSeen', {}) || {})[k]; },
      set(k) { const s = store.get('uiSeen', {}) || {}; s[k] = true; store.set('uiSeen', s); },
      all() { return store.get('uiSeen', {}) || {}; },
    },
    reducedMotion: () => !!safe(() => settings.get('reducedMotion'), false),
    sceneTitle() { setScene('title', safe(() => app.profile.lastSpecies, 'oli')); },
    sceneShowroom(speciesId, look) { setScene('showroom', speciesId, look); },
    flourish,
  };

  function setScene(kind, speciesId, look, force = false) {
    const key = kind + ':' + speciesId;
    if (!force && key === sceneKey) { if (look) safe(() => app.renderer.setLook(look)); return; }
    sceneKey = key;
    const lk = look || safe(() => app.profile.getLook(speciesId), null);
    safe(() => app.showScene(kind, kind === 'showroom' ? { speciesId, look: lk, framing: 'centre' } : { speciesId, look: lk }));
  }

  // ------------------------------------------------------------ show
  function show(name, params = {}) {
    if (name === 'play') name = 'worlds';
    const factory = name === 'hud' ? null : SCREENS[name];
    if (name !== 'hud' && !factory) { console.warn('[ui] unknown screen', name); return; }
    closeModal();
    const prevName = currentName;
    currentName = name;

    // the HUD persists through pause and photo, and is rebuilt for each new run
    const run = app.run;
    const runKey = run ? `${run.worldId}:${run.seed}:${run.mode}` : null;
    if (!run) destroyHUD();
    if (name === 'hud') {
      if (!hud || hudRunKey !== runKey) { destroyHUD(); hud = createHUD(ctx); hudRunKey = runKey; hudLayer.appendChild(hud.el); }
      hud.setVisible(true);
    } else if (hud) hud.setVisible(false);

    // swap screens
    if (cur) {
      const old = cur;
      safe(() => old.destroy?.());
      old.el.classList.add('gp-leaving');
      setTimeout(() => old.el.remove(), 230);
    }
    cur = null;
    safe(() => app.input.touch?.setVisible?.(name === 'hud'));
    if (name === 'hud') { if (prevName && prevName !== 'hud' && prevName !== 'pause') ctx.sound('whoosh'); return; }
    let scr;
    try { scr = factory(ctx, params || {}); } catch (e) { console.error('[ui] screen failed', name, e); scr = { el: h('div', { class: 'gp-screen' }, String(e.message || e)) }; }
    scr.name = name;
    scr.el.classList.add('gp-screen');
    cur = scr;
    screenLayer.appendChild(scr.el);
    if (scr.scene) setScene(scr.scene.kind, scr.scene.speciesId, scr.scene.look);
    if (scr.scene?.kind === 'showroom') scr.el.dataset.lookSurface = '1';
    if (prevName !== name) ctx.sound('whoosh');
    if (rootEl.classList.contains('gp-kb')) setTimeout(() => focusFirst(), 60);
  }

  function destroyHUD() {
    if (!hud) return;
    safe(() => hud.destroy());
    hud.el.remove();
    hud = null; hudRunKey = null;
  }

  // ------------------------------------------------------------ focus navigation
  function scope() { return modal ? modal.el : cur?.el; }
  function focusables() {
    const sc = scope();
    if (!sc) return [];
    return [...sc.querySelectorAll('.gp-nav')].filter((el) => !el.disabled && el.offsetParent !== null && el.getClientRects().length);
  }
  function focusFirst() {
    const sc = scope();
    if (!sc) return;
    const def = sc.querySelector('[data-default]') || focusables()[0];
    if (def && !def.disabled) focusEl(def);
  }
  function focusEl(el) {
    try { el.focus({ preventScroll: true, focusVisible: true }); } catch { el.focus(); }
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: ctx.reducedMotion() ? 'auto' : 'smooth' });
  }
  function move(dir) {
    const list = focusables();
    if (!list.length) return;
    const active = document.activeElement;
    if (!active || !list.includes(active)) { focusFirst(); return; }
    const rects = list.map((el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const from = rects[list.indexOf(active)];
    const idx = navPick(from, rects.map((r, i) => (list[i] === active ? from : r)), dir);
    if (idx >= 0) { focusEl(list[idx]); ctx.sound('tick'); }
  }

  const dedupe = createActionDeduper(80);
  let lastEnterAt = -1e9, lastEscAt = -1e9;
  function nav(action, source, info = {}) {
    const n = now();
    if (!dedupe(action, source, n)) return;
    if (!rootEl.isConnected) return;
    if (currentName === 'hud' && !modal) return;
    rootEl.classList.add('gp-kb');
    const active = document.activeElement;
    if (isText(active)) {
      if (action === 'confirm' || action === 'cancel') active.blur();
      return;
    }
    if (modal) {
      if (action === 'cancel') { modal.cancel?.(); return; }
    } else if (cur?.onMenu && cur.onMenu(action) === true) return;
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      if ((action === 'left' || action === 'right') && active?.gpAdjust && scope()?.contains(active)) { active.gpAdjust(action === 'left' ? -1 : 1); return; }
      move(action);
      return;
    }
    if (action === 'confirm') {
      const sc = scope();
      if (!active || !sc?.contains(active) || active === document.body) { focusFirst(); return; }
      if (isNative(active) && (info.native || source === 'kb' || n - lastEnterAt < 150)) return; // the browser clicks it
      active.click?.();
      return;
    }
    if (action === 'cancel') {
      if (app.run && (n - lastEscAt < 250 || (info.source === 'kb' && currentName === 'pause'))) return; // main.js owns Esc during runs (raw.pause)
      if (cur?.back) { ctx.sound('back'); cur.back(); }
      return;
    }
    if (action === 'tabNext' || action === 'tabPrev') { if (cur?.tab) { cur.tab(action === 'tabNext' ? 1 : -1); ctx.sound('tick'); } }
  }

  // input module first, keyboard listener as a fallback (deduped)
  safe(() => app.input.onMenu?.((a, info) => nav(a, 'input', info || {})));

  const codeBuf = createCodeBuffer({ check: (b) => app.profile?.codes?.check?.(b) ?? null });
  const konami = createKonamiMatcher();
  let lastKonamiAt = -1e9;
  function onCode(hit) {
    if (!hit) return;
    const on = hit.on !== undefined ? hit.on : !safe(() => app.profile.modifiers[hit.modifier], false);
    if (hit.on === undefined) safe(() => app.profile.setModifier(hit.modifier, on));
    safe(() => app.bus.emit(EV.CODE, { type: EV.CODE, code: hit.code, modifier: hit.modifier, on }));
    ctx.sound('star');
    flourish();
    toast(t(on ? 'ui.code.on' : 'ui.code.off', { mod: modName(hit.modifier) }), { icon: 'sparkle', kind: 'gold' });
  }
  function onKonami() {
    const n = now();
    if (n - lastKonamiAt < 1500 || currentName !== 'title') return;
    lastKonamiAt = n;
    const tok = app.profile?.codes?.KONAMI || 'KONAMI';
    let hit = safe(() => app.profile.codes.check(tok), null);
    if (!hit) hit = { code: tok, modifier: 'goodBoy' };
    onCode(hit);
  }
  safe(() => app.input.onText?.((ch) => { if (currentName === 'title' && !modal) onCode(codeBuf.push(ch, now())); }));
  safe(() => app.input.onKonami?.(() => onKonami()));

  // capture phase: runs before the input module's own window listener
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') lastEnterAt = now();
    if (e.code === 'Escape') lastEscAt = now();
  }, true);
  const onKey = (e) => {
    if (isText(e.target) && e.code !== 'Escape' && e.code !== 'Enter') return;
    if (currentName === 'title' && !modal && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key && e.key.length === 1) onCode(codeBuf.push(e.key, now()));
      const kt = KONAMI_KEYS[e.code];
      if (kt && konami.push(kt)) onKonami();
      else if (!kt) konami.push('x');
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir = KEY_DIRS[e.code];
    if (dir) {
      if (currentName === 'hud' && !modal) return;
      e.preventDefault();
      nav(dir, 'kb');
      return;
    }
    if (e.repeat) return;
    let a = KEY_EDGE[e.code];
    if (a && (a === 'tabPrev' || a === 'tabNext') && currentName === 'title') a = null;
    if (e.code === 'Backspace' && isText(e.target)) a = null;
    if (a) nav(a, 'kb');
  };
  window.addEventListener('keydown', onKey);

  // pointer: hover focuses, movement leaves keyboard mode, parallax
  let parallaxQueued = false, px = 0, py = 0;
  rootEl.addEventListener('pointerover', (e) => {
    const el = e.target.closest?.('.gp-nav');
    if (!el || isText(el) || el === document.activeElement || isText(document.activeElement)) return;
    if (e.pointerType === 'mouse') { try { el.focus({ preventScroll: true }); } catch { /* ignore */ } ctx.sound('tick'); }
  });
  window.addEventListener('pointermove', (e) => {
    rootEl.classList.remove('gp-kb');
    if (ctx.reducedMotion()) return;
    px = (e.clientX / innerWidth - 0.5) * 2; py = (e.clientY / innerHeight - 0.5) * 2;
    if (!parallaxQueued) {
      parallaxQueued = true;
      requestAnimationFrame(() => { parallaxQueued = false; rootEl.style.setProperty('--px', px.toFixed(3)); rootEl.style.setProperty('--py', py.toFixed(3)); });
    }
  }, { passive: true });

  // ------------------------------------------------------------ toasts
  function toast(text, { icon: ic = 'sparkle', kind = '', ttl = 2.6, colour } = {}) {
    toasts.push({ text, icon: ic, kind, ttl, colour });
  }
  function tickToasts() {
    const n = now() / 1000;
    const { added, removed } = toasts.tick(n);
    for (const item of removed) {
      const el = liveToasts.get(item);
      if (el) { el.classList.add('gp-out'); setTimeout(() => el.remove(), 360); liveToasts.delete(item); }
    }
    for (const item of added) {
      const el = h('div', { class: 'gp-toast' + (item.kind ? ' gp-toast--' + item.kind : ''), vars: item.colour ? { c: item.colour } : null }, icon(item.icon), h('span', null, item.text));
      toastWrap.appendChild(el);
      liveToasts.set(item, el);
    }
  }

  // ------------------------------------------------------------ flourish (title codes)
  function flourish() {
    if (ctx.reducedMotion()) return;
    const f = h('div', { class: 'gp-flourish' });
    const cols = ['#ffd166', '#ff7a59', '#2bb59a', '#a996ff', '#8fd3f4'];
    for (let i = 0; i < 26; i++) {
      const el = h('i', { vars: { x: (Math.random() * 100).toFixed(1) + '%', s: (3 + Math.random() * 5).toFixed(1), c: cols[i % cols.length], d: (Math.random() * 0.5).toFixed(2) + 's', rot: ((Math.random() - 0.5) * 120).toFixed(0) + 'deg' } });
      el.innerHTML = i % 3 ? ICONS.sparkle : ICONS.star;
      f.appendChild(el);
    }
    fxLayer.appendChild(f);
    setTimeout(() => f.remove(), 2400);
  }

  // ------------------------------------------------------------ modal
  function openModal({ title, body, buttons = [], onCancel } = {}) {
    closeModal();
    const btns = h('div', { class: 'gp-row gp-wrap' });
    const card = h('div', { class: 'gp-panel' }, title ? h('h2', { class: 'gp-h2' }, title) : null, body || null, btns);
    const el = h('div', { class: 'gp-modal' }, card);
    const m = { el, cancel: () => { closeModal(); onCancel?.(); } };
    buttons.forEach((b, i) => {
      const be = h('button', { class: 'gp-btn gp-nav ' + (b.variant ? 'gp-btn--' + b.variant : ''), type: 'button', 'data-default': i === 0 ? '1' : null }, b.icon ? icon(b.icon) : null, h('span', null, b.label));
      be.addEventListener('click', () => { ctx.sound(b.sound || 'select'); if (b.keepOpen !== true) closeModal(); b.onClick?.(); });
      btns.appendChild(be);
    });
    el.addEventListener('click', (e) => { if (e.target === el) m.cancel(); });
    rootEl.appendChild(el);
    modal = m;
    setTimeout(() => { if (modal === m) focusFirst(); }, 30);
    return m;
  }
  function closeModal() { if (modal) { modal.el.remove(); modal = null; } }

  // ------------------------------------------------------------ count-ups
  function addCountUp(el, from, to, { delay = 0, dur, format = (v) => String(Math.round(v)), sound = true, onDone } = {}) {
    const d = dur ?? countUpDuration(to - from);
    const tw = { el, from, to, start: now() + delay * 1000, dur: d, format, sound, last: from, onDone };
    el.textContent = format(from);
    tweens.push(tw);
    return tw;
  }
  function tickTweens() {
    const n = now();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (!tw.el.isConnected) { tweens.splice(i, 1); continue; }
      const e = (n - tw.start) / 1000;
      if (e < 0) continue;
      const v = countUp(tw.from, tw.to, e, tw.dur);
      const s = tw.format(v);
      if (tw.el.textContent !== s) { tw.el.textContent = s; if (tw.sound) ctx.sound('count'); }
      if (e >= tw.dur) { tweens.splice(i, 1); tw.onDone?.(); }
    }
  }

  // ------------------------------------------------------------ bus events
  const busOffs = [];
  const on = (type, fn) => { const off = safe(() => app.bus.on(type, fn), null); if (off) busOffs.push(off); };
  on(EV.JOURNAL_NEW, (ev) => toast(t('ui.hud.newItem', { name: itemName(ev.itemType) }), { icon: 'book', kind: '', colour: '#2bb59a' }));
  on(EV.EGG, (ev) => {
    const name = tk(`egg.${ev.id}.name`, null);
    toast(name ? t('ui.hud.egg', { name }) : t('ui.hud.eggAnon'), { icon: 'egg', kind: 'gold' });
  });
  on(EV.GOLDEN, (ev) => toast(t('ui.hud.golden', { name: itemName(ev.itemType) }), { icon: 'star', kind: 'gold' }));
  on(EV.ACHIEVEMENT, (ev) => toast(t('ui.hud.achievement', { name: tk(`ach.${ev.id}.name`, ev.id) }), { icon: 'trophy', kind: 'gold' }));
  on(EV.UNLOCK, (ev) => {
    let name = ev.id;
    if (ev.kind === 'species') name = speciesName(ev.id);
    else if (ev.kind === 'world') name = worldName(ev.id);
    else if (ev.kind === 'cosmetic') name = cosmeticName((app.data.COSMETICS || []).find((c) => c.id === ev.id) || { id: ev.id });
    toast(t('ui.hud.unlock', { name }), { icon: 'sparkle', kind: 'gold' });
  });
  on('*', (ev, type) => { if (hud) safe(() => hud.onEvent(type, ev)); if (cur?.onEvent) safe(() => cur.onEvent(type, ev)); });

  // achievements earned outside runs (shop, codes, names)
  function drainPending() {
    const p = safe(() => app.profile.achievements.pending?.(), []);
    for (const id of p || []) toast(t('ui.hud.achievement', { name: tk(`ach.${id}.name`, id) }), { icon: 'trophy', kind: 'gold' });
  }

  let pendingAcc = 0;
  return {
    get current() { return currentName; },
    show,
    frame(dtReal, simState) {
      if (hud && currentName === 'hud') hud.frame(dtReal, simState);
      if (cur?.frame) safe(() => cur.frame(dtReal, simState));
      tickTweens();
      tickToasts();
      pendingAcc += dtReal || 0;
      if (pendingAcc > 1 && !app.run) { pendingAcc = 0; drainPending(); }
    },
    onEvent() {},
    destroy() {
      window.removeEventListener('keydown', onKey);
      for (const off of busOffs) safe(() => off());
      clear(rootEl); rootEl.remove();
    },
  };
}
