// Play: a storybook map of the five worlds, plus details and mode choice.

import { h, clear } from '../dom.js';
import { icon } from '../icons.js';
import { worldArt } from '../art.js';
import { btn, topBar, starsEl, portraitEl, seg, svgEl, biccieChip, splitPanel, confetti } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { formatSizeUI, formatClock } from '../logic.js';
import { safe, tk, worldIds, getWorldData, worldName, worldBlurb, speciesName, itemName } from '../data.js';
import { startRun, currentSpecies } from './flow.js';

const POS = [[11, 64], [30, 32], [50, 66], [70, 33], [89, 62]];
const MODES = ['story', 'chill', 'speedrun', 'zoomies'];

export function worldsScreen(ctx, params) {
  const { app } = ctx;
  const ids = worldIds(app).slice(0, 5);
  const unlocked = (id) => !!getWorldData(app, id) && safe(() => app.profile.isWorldUnlocked(id), id === 'w1');
  let sel = params.worldId && ids.includes(params.worldId) ? params.worldId : pickDefault();
  let mode = MODES.includes(params.mode) ? params.mode : 'story';
  let speciesId = params.speciesId || currentSpecies(app);

  function pickDefault() {
    const open = ids.filter(unlocked);
    const unfinished = open.find((id) => !safe(() => app.profile.finished?.(id), false));
    return unfinished || open[open.length - 1] || 'w1';
  }

  const back = () => ctx.show(params.from && params.from !== 'worlds' ? params.from : 'title', {});

  // map
  const map = h('div', { class: 'gp-panel gp-map' });
  const pts = POS.map(([x, y]) => `${x},${y}`);
  map.appendChild(svgEl(`<svg class="gp-map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path d="M${pts[0]} C20,64 20,32 ${pts[1]} S40,66 ${pts[2]} S60,33 ${pts[3]} S80,62 ${pts[4]}" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" vector-effect="non-scaling-stroke" opacity=".85"/>
    <path d="M${pts[0]} C20,64 20,32 ${pts[1]} S40,66 ${pts[2]} S60,33 ${pts[3]} S80,62 ${pts[4]}" fill="none" stroke="#e7a25c" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg>`, 'gp-map-deco'));
  map.appendChild(confetti(10, 11));
  const nodes = ids.map((id, i) => {
    const w = getWorldData(app, id);
    const open = unlocked(id);
    const st = safe(() => app.profile.stars(id), [false, false, false]);
    const art = svgEl(worldArt(id), 'gp-node-art');
    art.appendChild(h('span', { class: 'gp-node-num' }, String(i + 1)));
    if (!open) art.appendChild(h('span', { class: 'gp-node-lock' }, icon('lock')));
    const node = h('button', { class: 'gp-node gp-nav gp-pop' + (open ? '' : ' gp-locked'), type: 'button', vars: { x: POS[i][0] + '%', y: POS[i][1] + '%', i }, 'aria-label': worldName(id) },
      art, h('span', { class: 'gp-node-name' }, worldName(id)), w && open ? starsEl(st) : null);
    if (id === sel) node.dataset.default = '1';
    node.addEventListener('click', () => { ctx.sound(open ? 'select' : 'tick'); select(id); });
    node.addEventListener('dblclick', () => { if (open) go(); });
    map.appendChild(node);
    return node;
  });

  // detail panel
  const detail = h('div', { class: 'gp-panel gp-split' });

  function select(id) {
    sel = id;
    nodes.forEach((n, i) => n.classList.toggle('gp-on', ids[i] === id));
    renderDetail();
  }

  function go() {
    if (!unlocked(sel)) return;
    startRun(ctx, { worldId: sel, speciesId, mode });
  }

  function starRules(w) {
    const g = w?.goals || {};
    const s3 = g.star3 || {};
    const k = s3.kind || 'noHazards';
    const star3 = t(`ui.star3.${k}`, { type: s3.type ? itemName(s3.type).toLowerCase() : '', count: s3.count || 30, time: formatClock(g.par || 0) });
    return [
      t('ui.star.goal', { size: formatSizeUI(g.goal || 0) }),
      mode === 'chill' ? t('ui.star.stretchChill', { size: formatSizeUI(g.stretch || 0), time: formatClock(g.par || 0) }) : t('ui.star.stretch', { size: formatSizeUI(g.stretch || 0) }),
      star3,
    ];
  }

  function renderDetail() {
    clear(detail);
    const w = getWorldData(app, sel);
    const idx = ids.indexOf(sel);
    const open = unlocked(sel);
    const st = safe(() => app.profile.stars(sel), [false, false, false]);
    const best = safe(() => app.profile.best(sel), null);
    const banner = svgEl(worldArt(sel, 'rect'), 'gp-world-banner');
    banner.appendChild(h('span', { class: 'gp-node-num' }, String(idx + 1)));
    const body = h('div', { class: 'gp-scroll gp-col' },
      banner,
      h('div', { class: 'gp-col', style: { gap: 'calc(0.6 * var(--u))' } },
        h('h2', { class: 'gp-h2' }, worldName(sel)),
        h('p', { class: 'gp-p gp-muted' }, w ? worldBlurb(w) : t('ui.worlds.soon'))));
    if (w && open) {
      const g = w.goals || {};
      body.appendChild(h('div', { class: 'gp-row gp-wrap', style: { gap: 'calc(1 * var(--u))' } },
        h('span', { class: 'gp-chip gp-chip--ghost' }, icon('ruler'), t('ui.worlds.goal', { start: formatSizeUI(g.start || 0.25), goal: formatSizeUI(g.goal || 1) })),
        h('span', { class: 'gp-chip gp-chip--ghost' }, icon('clock'), mode === 'story' || mode === 'speedrun' ? t('ui.worlds.timer', { time: formatClock(g.timer || 300) }) : t('ui.worlds.noTimer')),
        h('span', { class: 'gp-chip gp-chip--ghost' }, icon('trophy'), best?.size ? t('ui.worlds.best', { size: formatSizeUI(best.size) }) : t('ui.worlds.noBest'))));
      if (mode !== 'zoomies') {
        const rules = starRules(w);
        body.appendChild(h('div', { class: 'gp-star-list' }, rules.map((r, i) => (mode === 'chill' && i === 1) ? null : h('div', { class: 'gp-row' }, h('span', { class: 'gp-star' + (st[i] ? ' gp-on' : '') }, icon('star')), h('span', null, r)))));
      }
      const modeSeg = seg(ctx, MODES.map((m) => ({ id: m, label: t(`ui.mode.${m}`) })), mode, (m) => { mode = m; renderDetail(); });
      body.appendChild(h('div', { class: 'gp-col', style: { gap: 'calc(0.8 * var(--u))' } }, h('span', { class: 'gp-label' }, t('ui.worlds.mode')), modeSeg.el, h('span', { class: 'gp-small' }, t(`ui.mode.${mode}Desc`))));
      const change = btn(ctx, t('ui.worlds.pickAnimal'), { variant: 'cream', sm: true, onClick: () => ctx.show('animals', { from: 'worlds', worldId: sel, mode, speciesId, pick: true }) });
      body.appendChild(h('div', { class: 'gp-playing-as' }, portraitEl(speciesId, safe(() => app.profile.getLook(speciesId), {})),
        h('div', { class: 'gp-col gp-grow', style: { gap: 0 } }, h('span', { class: 'gp-small' }, t('ui.worlds.playingAs')), h('b', { class: 'gp-h3' }, safe(() => app.profile.getName(speciesId), speciesName(speciesId)))), change));
    } else if (w) {
      const hintKey = safe(() => app.profile.worldHint?.(sel), '');
      const prev = ids[idx - 1];
      const hint = tk(hintKey, t('ui.worlds.unlockHint', { world: worldName(prev || 'w1') }));
      body.appendChild(h('div', { class: 'gp-lock-note' }, icon('lock'), h('span', null, hint)));
    }
    detail.appendChild(body);
    const goBtn = btn(ctx, t('ui.worlds.go'), { icon: 'paw', big: true, onClick: go, attrs: open && w ? {} : { disabled: true } });
    detail.appendChild(h('div', { class: 'gp-foot' }, goBtn));
  }

  select(sel);

  const el = h('div', { class: 'gp-backdrop' },
    topBar(ctx, t('ui.worlds.title'), { onBack: back, right: [biccieChip(safe(() => app.profile.biccies, 0))] }),
    h('div', { class: 'gp-worlds-body' }, map, detail));

  return {
    el,
    scene: { kind: 'title', speciesId },
    back,
    tab(dir) {
      const i = (ids.indexOf(sel) + dir + ids.length) % ids.length;
      select(ids[i]);
    },
  };
}
