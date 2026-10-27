// Shared UI building blocks: buttons, top bars, sliders, toggles, segmented
// pickers, stars, portraits, item tokens and background confetti.

import { h, fromHTML } from './dom.js';
import { icon, ICONS } from './icons.js';
import { portraitSVG } from './art.js';
import { t } from '../core/copy/index.js';
import { formatInt } from './logic.js';
import { tokenColour, initials } from './data.js';

export function btn(ctx, label, opts = {}) {
  const { icon: ic, variant, sub, onClick, big, sm, cls = '', attrs = {}, sound = 'select', i } = opts;
  const classes = ['gp-btn', 'gp-nav'];
  if (variant) classes.push('gp-btn--' + variant);
  if (big) classes.push('gp-btn--big');
  if (sm) classes.push('gp-btn--sm');
  if (cls) classes.push(cls);
  if (i != null) classes.push('gp-pop');
  const content = sub
    ? h('span', { class: 'gp-stack' }, h('span', null, label), h('span', { class: 'gp-sub' }, sub))
    : (label != null ? h('span', null, label) : null);
  const b = h('button', { class: classes.join(' '), type: 'button', ...attrs, vars: i != null ? { i } : null }, ic ? icon(ic) : null, content);
  if (onClick) b.addEventListener('click', (e) => { if (b.disabled) return; if (sound) ctx.sound(sound); onClick(e); });
  return b;
}

export function iconBtn(ctx, name, label, onClick, variant = 'cream', sound = 'select') {
  const b = btn(ctx, null, { icon: name, variant, onClick, sound, attrs: { 'aria-label': label, title: label } });
  b.classList.add('gp-btn--icon');
  return b;
}

export function topBar(ctx, title, { onBack, right = [], tabs = null } = {}) {
  const back = onBack ? iconBtn(ctx, 'back', t('ui.back'), onBack, 'cream', 'back') : null;
  if (back) back.dataset.back = '1';
  return h('div', { class: 'gp-top' }, back, h('h1', { class: 'gp-h1' }, title), tabs, h('div', { class: 'gp-spacer' }), right);
}

export function biccieChip(n) {
  const chip = h('span', { class: 'gp-chip gp-biccies-chip', title: t('ui.biccies') }, icon('biccie'), h('span', { class: 'gp-num' }, formatInt(n)));
  return chip;
}

export function starsEl(arr = [false, false, false], cls = '') {
  return h('span', { class: 'gp-stars ' + cls }, [0, 1, 2].map((i) => h('span', { class: 'gp-star' + (arr?.[i] ? ' gp-on' : '') }, icon('star'))));
}

export function portraitEl(speciesId, look, opts = {}) {
  const w = h('span', { class: 'gp-portrait-wrap ' + (opts.cls || '') });
  w.innerHTML = portraitSVG(speciesId, look, opts);
  return w;
}

export function svgEl(markup, cls = '') {
  const w = h('div', { class: cls });
  w.innerHTML = markup;
  return w;
}

const SHAPE_GLYPH = { circle: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16z', triangle: 'M12 3l9 16H3z', square: 'M5 5h14v14H5z', star: ICONS.star };
export function tokenEl(item, { found = true, golden = false, label } = {}) {
  const c = tokenColour(item?.id || '?');
  const tok = h('span', { class: 'gp-token' + (found ? '' : ' gp-unknown') + (golden ? ' gp-goldtok' : ''), vars: { c, r: ((item?.id || '').length % 5 - 2) * 2 + 'deg' } }, found ? initials(label) : '?');
  if (found && item?.shape) {
    const shape = item.shape === 'star' ? fromHTML(ICONS.star) : fromHTML(`<svg viewBox="0 0 24 24" class="gp-ico"><path d="${SHAPE_GLYPH[item.shape] || SHAPE_GLYPH.circle}" fill="currentColor"/></svg>`);
    tok.appendChild(h('span', { class: 'gp-shape' }, shape));
  }
  return tok;
}

// Custom slider (keyboard and pad friendly via gpAdjust; no native range).
export function slider(ctx, { value = 0.5, min = 0, max = 1, step = 0.01, onInput, onCommit, format, track, knob, label } = {}) {
  const el = h('div', { class: 'gp-slider gp-nav', tabindex: '0', role: 'slider', 'aria-label': label || '', 'aria-valuemin': min, 'aria-valuemax': max });
  const k = h('span', { class: 'gp-knob' });
  el.appendChild(k);
  const val = h('span', { class: 'gp-val gp-num' });
  let v = value;
  const set = (nv, fire = true) => {
    nv = Math.min(max, Math.max(min, Math.round(nv / step) * step));
    if (Math.abs(nv - v) < 1e-9 && fire) return;
    v = nv;
    el.style.setProperty('--v', String((v - min) / (max - min || 1)));
    el.setAttribute('aria-valuenow', String(v));
    val.textContent = format ? format(v) : String(v);
    if (fire && onInput) onInput(v);
  };
  if (track) el.style.setProperty('--track', track);
  if (knob) el.style.setProperty('--knob', knob);
  v = NaN; set(value, false); v = Math.min(max, Math.max(min, value));
  el.style.setProperty('--v', String((v - min) / (max - min || 1)));
  val.textContent = format ? format(v) : String(v);
  const fromX = (x) => { const r = el.getBoundingClientRect(); return min + (max - min) * Math.min(1, Math.max(0, (x - r.left) / (r.width || 1))); };
  let dragging = false;
  el.addEventListener('pointerdown', (e) => { dragging = true; el.setPointerCapture?.(e.pointerId); set(fromX(e.clientX)); e.preventDefault(); el.focus({ preventScroll: true }); });
  el.addEventListener('pointermove', (e) => { if (dragging) set(fromX(e.clientX)); });
  const end = () => { if (dragging) { dragging = false; onCommit?.(v); ctx.sound('tick'); } };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  const bigStep = Math.max(step, (max - min) / 20);
  el.gpAdjust = (dir) => { set(v + dir * bigStep); onCommit?.(v); ctx.sound('tick'); return true; };
  return { el, val, set: (nv) => set(nv, false), get value() { return v; }, setTrack: (tr) => el.style.setProperty('--track', tr) };
}

export function sliderRow(ctx, label, opts) {
  const s = slider(ctx, { ...opts, label });
  return { row: h('div', { class: 'gp-slider-row' }, h('span', { class: 'gp-lab' }, label), s.el, s.val), s };
}

export function toggle(ctx, on, onChange, label = '') {
  const b = h('button', { class: 'gp-toggle gp-nav' + (on ? ' gp-on' : ''), type: 'button', role: 'switch', 'aria-checked': String(!!on), 'aria-label': label });
  let state = !!on;
  const set = (s) => { state = s; b.classList.toggle('gp-on', s); b.setAttribute('aria-checked', String(s)); };
  b.addEventListener('click', () => { set(!state); ctx.sound(state ? 'select' : 'back'); onChange?.(state); });
  b.gpAdjust = (dir) => { if ((dir > 0) !== state) b.click(); return true; };
  return { el: b, set };
}

export function seg(ctx, options, value, onChange) {
  const wrap = h('div', { class: 'gp-seg', role: 'radiogroup' });
  const btns = options.map((o) => {
    const b = h('button', { class: 'gp-nav' + (o.id === value ? ' gp-on' : ''), type: 'button', disabled: o.disabled || null, title: o.title || null }, o.icon ? icon(o.icon) : null, o.label);
    b.addEventListener('click', () => { if (o.disabled) return; ctx.sound('select'); setVal(o.id); onChange?.(o.id); });
    wrap.appendChild(b);
    return b;
  });
  function setVal(id) { options.forEach((o, i) => btns[i].classList.toggle('gp-on', o.id === id)); }
  return { el: wrap, set: setVal };
}

export function confetti(n = 18, seed = 3) {
  const wrap = h('div', { class: 'gp-confetti', 'aria-hidden': 'true' });
  const cols = ['#ff7a59', '#2bb59a', '#ffd166', '#8fd3f4', '#a996ff', '#ff9fb2'];
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const paw = r() > 0.55;
    const el = h('i', { class: paw ? 'gp-paw' : '', vars: { s: (paw ? 4 + r() * 4 : 1 + r() * 2.4).toFixed(2), c: cols[i % cols.length], d: (-r() * 9).toFixed(2) + 's' } });
    el.style.left = (r() * 100).toFixed(1) + '%';
    el.style.top = (r() * 100).toFixed(1) + '%';
    if (paw) el.innerHTML = ICONS.paw;
    wrap.appendChild(el);
  }
  return wrap;
}

export function panel(cls = '', ...kids) { return h('div', { class: 'gp-panel ' + cls }, ...kids); }

// A panel with a scrolling middle and a pinned footer.
export function splitPanel(cls, body, foot) {
  return h('div', { class: 'gp-panel gp-split ' + cls }, h('div', { class: 'gp-scroll gp-col' }, body), foot && foot.length ? h('div', { class: 'gp-foot' }, foot) : null);
}

export function empty(iconName, text) {
  return h('div', { class: 'gp-empty' }, icon(iconName), h('div', null, text));
}
