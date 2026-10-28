// In-game HUD (SPEC §10). Size badge top-left, timer top-centre (timed modes
// only), goal and stars top-right, combo lower-left only during combos. No
// control hints, nothing reserves space when empty, the centre stays clear.

import { h, setText, bump } from './dom.js';
import { icon } from './icons.js';
import { EV } from '../core/events.js';
import { t } from '../core/copy/index.js';
import { formatSizeUI, formatClock, milestoneProgress, timerWarmth, mixColour, newStars, formatInt } from './logic.js';
import { safe, getWorldData } from './data.js';
import { starsEl } from './kit.js';

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

export function createHUD(ctx) {
  const { app } = ctx;
  const el = h('div', { class: 'gp-screen gp-hud gp-hud-screen' });

  // size badge
  const arc = svgNS('circle', { class: 'gp-ring-arc', cx: 50, cy: 50, r: RING_R, 'stroke-width': 7, 'stroke-dasharray': RING_C.toFixed(2), 'stroke-dashoffset': RING_C.toFixed(2) });
  const ring = svgNS('svg', { viewBox: '0 0 100 100' },
    svgNS('circle', { class: 'gp-ring-bg', cx: 50, cy: 50, r: 47, 'stroke-width': 1.5 }),
    svgNS('circle', { class: 'gp-ring-track', cx: 50, cy: 50, r: RING_R, 'stroke-width': 7 }),
    arc);
  const sizeNum = h('span', { class: 'gp-num' }, '0');
  const sizeUnit = h('small', null, 'cm');
  const sizeEl = h('div', { class: 'gp-size' }, sizeNum, sizeUnit);
  const capText = h('span', { class: 'gp-num' }, '');
  const cap = h('div', { class: 'gp-size-cap' }, icon('next'), capText);
  const nameEl = h('div', { class: 'gp-badge-name gp-outline' }, app.run?.name || '');
  const badge = h('div', { class: 'gp-badge' },
    h('div', { class: 'gp-badge-ring' }, h('div', { class: 'gp-badge-glow' }), ring, h('div', { class: 'gp-badge-core' }, sizeEl, cap)),
    nameEl);

  // timer
  const timerText = h('span', { class: 'gp-num' }, '');
  const timer = h('div', { class: 'gp-timer gp-outline', style: { display: 'none' } }, timerText);

  // goal + stars
  const goalTitle = h('div', { class: 'gp-goal-title' }, '');
  const goalSub = h('div', { class: 'gp-goal-sub' }, '');
  const stars = starsEl([false, false, false]);
  const goal = h('div', { class: 'gp-goal' }, h('div', { class: 'gp-goal-card' }, goalTitle, goalSub, stars));

  // combo
  const comboNum = h('span', { class: 'gp-num' }, '');
  const combo = h('div', { class: 'gp-combo' }, comboNum);

  // pause button for touch only
  const coarse = safe(() => matchMedia('(pointer: coarse)').matches, false);
  const touchy = coarse || safe(() => app.input.device === 'touch', false);
  const pauseBtn = touchy ? h('button', { class: 'gp-hud-btn', type: 'button', 'aria-label': t('ui.hud.pause') }, icon('pause')) : null;
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => { ctx.sound('select'); app.pause(); ctx.show('pause'); });
    goal.classList.add('gp-touch');
  }

  el.append(badge, timer, goal, combo);
  if (pauseBtn) el.appendChild(pauseBtn);

  // state
  let lastSizeKey = '', lastCap = '', lastTimer = '', lastPhase = null, lastWarm = -1;
  let prevStars = [false, false, false];
  let goalShownAt = 0, goalSmall = false;
  let comboLive = false, comboCount = 0;
  let goEl = null, goTimer = 0;
  let milestones = null, mode = app.run?.mode || 'story';
  const world = getWorldData(app, app.run?.worldId);
  if (world?.goals?.milestones) milestones = world.goals.milestones;

  function setGoal(state) {
    const g = state.goals || world?.goals || {};
    if (mode === 'zoomies') {
      setText(goalTitle, t('ui.hud.zoomies'));
      setText(goalSub, '');
      return;
    }
    setText(goalTitle, t('ui.hud.goal', { size: formatSizeUI(g.goal || 0) }));
    setText(goalSub, g.stretch ? t('ui.hud.stretch', { size: formatSizeUI(g.stretch) }) : '');
  }

  function showGo(kind) {
    if (kind === 'go' && goEl && goEl.classList.contains('gp-burst') && goTimer > 0.6) return;
    if (goEl) goEl.remove();
    if (kind === 'ready') {
      goEl = h('div', { class: 'gp-go gp-ready gp-outline' }, t('ui.hud.ready'));
    } else if (kind === 'go') {
      if (goEl && goEl.classList.contains('gp-burst') && goTimer > 0.6) return;
      goEl = h('div', { class: 'gp-go gp-burst' }, t('ui.hud.go'));
      goTimer = 1.15;
    } else if (kind === 'finish') {
      goEl = h('div', { class: 'gp-go gp-ready gp-finish-banner' }, t('ui.hud.finish'));
    }
    if (goEl) el.appendChild(goEl);
  }

  return {
    el,
    setVisible(v) { el.style.display = v ? '' : 'none'; },
    destroy() {},
    frame(dt, state) {
      if (!state) return;
      const p = state.player;
      // phase transitions
      if (state.phase !== lastPhase) {
        if (state.phase === 'intro') { /* the narrator's intro line is the 'ready' beat; no extra text */ }
        else if (state.phase === 'play' && lastPhase === 'intro') showGo('go');
        else if (state.phase === 'play' && goEl && goEl.classList.contains('gp-ready')) { goEl.remove(); goEl = null; }
        else if (state.phase === 'finished') showGo('finish');
        if (state.phase === 'play' && !goalShownAt) goalShownAt = ctx.now();
        lastPhase = state.phase;
        setGoal(state);
      }
      if (goTimer > 0) { goTimer -= dt; if (goTimer <= 0 && goEl) { goEl.remove(); goEl = null; } }
      if (!goalShownAt && state.phase !== 'intro') goalShownAt = ctx.now();
      if (!goalSmall && goalShownAt && ctx.now() - goalShownAt > 3000) { goalSmall = true; goal.classList.add('gp-small'); }

      // size
      const size = p ? (p.displaySize ?? p.size ?? 0) : 0;
      const label = formatSizeUI(size);
      if (label !== lastSizeKey) {
        lastSizeKey = label;
        const sp = label.lastIndexOf(' ');
        setText(sizeNum, label.slice(0, sp));
        setText(sizeUnit, label.slice(sp + 1));
      }
      const goals = { ...(state.goals || {}), milestones: milestones || state.goals?.milestones || [] };
      const mp = milestoneProgress(size, goals);
      arc.setAttribute('stroke-dashoffset', (RING_C * (1 - mp.t)).toFixed(2));
      arc.style.stroke = mp.done ? 'var(--gold)' : (size >= (goals.goal || Infinity) ? 'var(--sea)' : 'var(--coral)');
      const capLabel = mp.done ? '' : formatSizeUI(mp.next);
      if (capLabel !== lastCap) { lastCap = capLabel; setText(capText, capLabel); cap.style.visibility = capLabel ? '' : 'hidden'; }

      // timer
      if (state.timeLeft != null && Number.isFinite(state.timeLeft)) {
        if (timer.style.display === 'none') timer.style.display = '';
        const s = formatClock(Math.ceil(state.timeLeft));
        if (s !== lastTimer) { lastTimer = s; setText(timerText, s); }
        const w = Math.round(timerWarmth(state.timeLeft) * 50) / 50;
        if (w !== lastWarm) { lastWarm = w; timer.style.color = mixColour('#ffffff', '#ff6a45', w); }
      } else if (timer.style.display !== 'none') timer.style.display = 'none';

      // stars
      const st = state.stars || [false, false, false];
      const fresh = newStars(prevStars, st);
      if (fresh.length) {
        for (const i of fresh) {
          const s = stars.children[i];
          s.classList.add('gp-on');
          bump(s, 'gp-pulse');
        }
        ctx.sound('star');
      }
      prevStars = st.slice();

      // combo
      const c = p?.combo?.count || 0;
      if (c >= 2) {
        if (c !== comboCount) {
          comboCount = c;
          setText(comboNum, '×' + formatInt(c));
          combo.style.setProperty('--k', String(Math.min(1.5, 1 + (c - 2) * 0.03)));
          if (comboLive) bump(comboNum);
        }
        if (!comboLive) { comboLive = true; combo.classList.remove('gp-out'); combo.classList.add('gp-live'); }
      } else if (comboLive) {
        comboLive = false; comboCount = 0;
        combo.classList.remove('gp-live'); combo.classList.add('gp-out');
      }
    },
    onEvent(type, ev) {
      if (type === EV.MILESTONE) { badge.classList.remove('gp-milestone'); void badge.offsetWidth; badge.classList.add('gp-milestone'); }
      else if (type === EV.GOBBLE) { bump(sizeEl, 'gp-bump'); }
      else if (type === EV.STAR) { const s = stars.children[ev.index]; if (s) { s.classList.add('gp-on'); bump(s, 'gp-pulse'); } goal.classList.remove('gp-small'); goalSmall = false; goalShownAt = ctx.now() - 1500; }
      else if (type === EV.GO) { if (lastPhase !== 'play') showGo('go'); }
    },
  };
}

function svgNS(tag, attrs, ...kids) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  for (const c of kids) el.appendChild(c);
  return el;
}
