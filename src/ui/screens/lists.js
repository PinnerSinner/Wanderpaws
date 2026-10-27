// Species log, Achievements and Stats.

import { h } from '../dom.js';
import { icon } from '../icons.js';
import { topBar, portraitEl, statBarsEl, biccieChip } from '../kit.js';
import { t } from '../../core/copy/index.js';
import { formatSizeUI } from '../logic.js';
import { safe, tk, speciesName, statValue, worldIds, prettyId } from '../data.js';
import { unlockText } from './animals.js';

function frame(ctx, params, title, body, own) {
  const { app } = ctx;
  const back = () => ctx.show(params.from && params.from !== own ? params.from : 'title', {});
  const el = h('div', { class: 'gp-backdrop' },
    topBar(ctx, title, { onBack: back, right: [biccieChip(safe(() => app.profile.biccies, 0))] }),
    h('div', { class: 'gp-panel gp-pad gp-scroll gp-grow gp-slide-l' }, body));
  return { el, back, scene: { kind: 'title', speciesId: safe(() => app.profile.lastSpecies, 'oli') } };
}

export function speciesScreen(ctx, params) {
  const { app } = ctx;
  const { SPECIES, SPECIES_ORDER } = app.data;
  const grid = h('div', { class: 'gp-species-grid' });
  (SPECIES_ORDER || Object.keys(SPECIES)).forEach((id, i) => {
    const sp = SPECIES[id];
    if (!sp) return;
    const open = safe(() => app.profile.isUnlocked(id), true);
    const best = safe(() => app.profile.speciesBest?.(id), 0);
    const look = safe(() => app.profile.getLook(id), sp.defaults);
    grid.appendChild(h('div', { class: 'gp-species gp-pop' + (open ? '' : ' gp-locked'), vars: { i: Math.min(i, 12) } },
      portraitEl(id, look, { silhouette: !open }),
      h('div', { class: 'gp-col', style: { gap: 'calc(0.6 * var(--u))', minWidth: 0 } },
        h('div', { class: 'gp-row', style: { justifyContent: 'space-between', gap: 'calc(1 * var(--u))' } },
          h('b', { class: 'gp-h3' }, open ? speciesName(id) : t('ui.unknown')),
          open ? h('span', { class: 'gp-chip ' + (best ? 'gp-chip--sea' : 'gp-chip--ghost') }, icon('ruler'), best ? formatSizeUI(best) : t('ui.species.none')) : h('span', { class: 'gp-chip gp-chip--ghost' }, icon('lock'))),
        open ? h('span', { class: 'gp-small' }, h('b', { style: { color: 'var(--coral-d)' } }, tk(sp.signature?.nameKey, prettyId(sp.signature?.kind || ''))), tk(sp.signature?.descKey, '') ? ' · ' + tk(sp.signature?.descKey, '') : '') : h('span', { class: 'gp-small' }, unlockText(app, sp)),
        open ? statBarsEl(sp, ['speed', 'turn', 'jump', 'reach']) : null)));
  });
  const scr = frame(ctx, params, t('ui.species.title'), grid, 'species');
  return scr;
}

export function achievementsScreen(ctx, params) {
  const { app } = ctx;
  const list = safe(() => app.profile.achievements.list(), []) || [];
  const earned = list.filter((a) => a.earned || safe(() => app.profile.achievements.has(a.id), false)).length;
  const body = h('div', { class: 'gp-col' });
  body.appendChild(h('div', { class: 'gp-row' }, h('b', { class: 'gp-h2 gp-num' }, t('ui.ach.count', { n: earned, total: list.length })),
    h('div', { class: 'gp-progress gp-grow' }, h('i', { vars: { v: list.length ? (earned / list.length).toFixed(3) : 0 } }))));
  const grid = h('div', { class: 'gp-ach-grid' });
  if (!list.length) grid.appendChild(h('div', { class: 'gp-empty' }, icon('trophy'), t('ui.ach.empty')));
  const sorted = [...list].sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0));
  sorted.forEach((a, i) => {
    const got = !!a.earned;
    const name = tk(a.nameKey || `ach.${a.id}.name`, prettyId(a.id));
    const desc = tk(a.descKey || `ach.${a.id}.desc`, '');
    grid.appendChild(h('div', { class: 'gp-ach gp-pop' + (got ? '' : ' gp-off'), vars: { i: Math.min(i, 16) } },
      h('span', { class: 'gp-ach-ico' }, icon(got ? 'trophy' : 'lock')),
      h('div', { class: 'gp-col', style: { gap: 'calc(0.3 * var(--u))', minWidth: 0 } }, h('b', { class: 'gp-h3' }, name), h('span', { class: 'gp-small' }, desc || t('ui.ach.secretDesc')))));
  });
  body.appendChild(grid);
  return frame(ctx, params, t('ui.ach.title'), body, 'achievements');
}

const STAT_ICON = { distance: 'paw', gobbled: 'mouth', biggestSize: 'ruler', pigeons: 'pigeon', tea: 'tea', eggs: 'egg', runs: 'map', timePlayed: 'clock', barks: 'speaker', playBows: 'heart', splashes: 'sparkle', jumps: 'bolt', bumps: 'undo', bestCombo: 'bolt', stars: 'star', biccies: 'biccie' };
const STAT_COL = ['#ff7a59', '#2bb59a', '#4fa6d4', '#a996ff', '#e9a93a', '#ff6fa8'];
const STAT_ORDER = ['distance', 'gobbled', 'biggestSize', 'stars', 'biccies', 'pigeons', 'tea', 'bestCombo', 'eggs', 'runs', 'timePlayed', 'barks', 'splashes', 'playBows', 'jumps', 'bumps'];

export function statsScreen(ctx, params) {
  const { app } = ctx;
  const stats = { ...(safe(() => app.profile.stats, {}) || {}) };
  if (stats.stars == null) stats.stars = worldIds(app).reduce((n, w) => n + (safe(() => app.profile.stars(w), []) || []).filter(Boolean).length, 0);
  const keys = [...STAT_ORDER.filter((k) => k in stats), ...Object.keys(stats).filter((k) => !STAT_ORDER.includes(k) && typeof stats[k] === 'number')];
  if (!keys.length) keys.push('distance', 'gobbled', 'biggestSize', 'stars');
  const grid = h('div', { class: 'gp-stat-grid' });
  keys.forEach((k, i) => {
    const v = Number(stats[k]) || 0;
    const b = h('b', { class: 'gp-num' }, statValue(k, 0));
    const label = tk(`meta.stat.${k}`, tk(`ui.stats.${k}`, prettyId(k)));
    grid.appendChild(h('div', { class: 'gp-stat gp-pop', vars: { i: Math.min(i, 16), c: STAT_COL[i % STAT_COL.length] } },
      h('span', { class: 'gp-stat-ico' }, icon(STAT_ICON[k] || 'sparkle')), h('span', { class: 'gp-label' }, label), b));
    const fmt = (x) => statValue(k, k === 'biggestSize' ? x : x);
    ctx.countUp(b, 0, v, { delay: 0.15 + i * 0.05, format: fmt, sound: i < 4 });
  });
  const pct = safe(() => app.profile.journal.pct(), null);
  if (pct != null) grid.appendChild(h('div', { class: 'gp-stat gp-pop', vars: { i: keys.length, c: '#2bb59a' } }, h('span', { class: 'gp-stat-ico' }, icon('book')), h('span', { class: 'gp-label' }, t('ui.stats.journal')), h('b', { class: 'gp-num' }, Math.round(pct) + '%')));
  return frame(ctx, params, t('ui.stats.title'), grid, 'stats');
}
